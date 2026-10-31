"""Run a disposable container and verify its platform and HTTP health."""

import argparse
import json
import subprocess
import time

from smoke_health import wait_for_health


def docker(*args: str) -> str:
    return subprocess.check_output(["docker", *args], text=True, timeout=60).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="riverbank-hackathon:base-01")
    parser.add_argument("--platform", default="linux/arm64")
    args = parser.parse_args()

    metadata = json.loads(docker("image", "inspect", args.image))[0]
    actual_platform = f"{metadata['Os']}/{metadata['Architecture']}"
    if actual_platform != args.platform:
        raise RuntimeError(f"Expected {args.platform}, got {actual_platform}")
    if metadata["Config"]["User"] != "10001:10001":
        raise RuntimeError("Runtime image must use the application user")

    container = docker(
        "run",
        "--detach",
        "--rm",
        "--platform",
        args.platform,
        "--publish",
        "127.0.0.1::8000",
        args.image,
    )
    try:
        binding = docker("port", container, "8000/tcp")
        wait_for_health(f"http://{binding}/health")
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            state = json.loads(docker("inspect", container))[0]["State"]
            status = state.get("Health", {}).get("Status")
            if status == "healthy":
                break
            if status == "unhealthy" or not state["Running"]:
                raise RuntimeError(
                    f"Container failed its scheduled healthcheck: {state}"
                )
            time.sleep(1)
        else:
            raise RuntimeError("Container did not become healthy within 45s")
        print(f"PASS image={args.image} platform={actual_platform} user=10001:10001")
    except Exception:
        subprocess.run(["docker", "logs", container], check=False, timeout=15)
        raise
    finally:
        docker("stop", "--time", "5", container)


if __name__ == "__main__":
    main()
