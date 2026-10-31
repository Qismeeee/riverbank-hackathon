"""Check the actual HTTP health contract using only the standard library."""

import argparse
import json
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener


def wait_for_health(url: str, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    opener = build_opener(ProxyHandler({}))
    last_error = "no response"
    while time.monotonic() < deadline:
        try:
            with opener.open(url, timeout=2) as response:
                payload = json.load(response)
                if response.status == 200 and payload == {"status": "ok"}:
                    print(f"PASS {url}: HTTP 200 {json.dumps(payload)}", flush=True)
                    return
                last_error = f"HTTP {response.status}, payload={payload!r}"
        except (URLError, OSError, ValueError) as error:
            last_error = str(error)
        time.sleep(1)
    raise RuntimeError(f"Health check failed after {timeout}s: {last_error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", nargs="?", default="http://127.0.0.1:8000/health")
    args = parser.parse_args()
    wait_for_health(args.url)
