"""Verify authenticated service IO, isolation and restart persistence with fake data."""

import argparse
import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

from service_secrets import materialize

ROOT = Path(__file__).resolve().parents[1]


def verify(
    compose: list[str], environment: dict[str, str], api_image: str | None
) -> None:
    def command(*arguments: str, data: str | None = None, success: bool = True) -> str:
        result = subprocess.run(
            [*compose, *arguments],
            input=data,
            capture_output=True,
            text=True,
            env=environment,
            timeout=300,
        )
        if success and result.returncode:
            # Broker logs and exception text can contain credential arguments.
            raise RuntimeError(f"Service check failed: {arguments[:3]}")
        return result.stdout.strip()

    broker = ["exec", "-T", "-e", "KAFKA_HEAP_OPTS=-Xms32m -Xmx96m", "kafka"]
    client = [
        "--bootstrap-server",
        "kafka:9092",
        "--command-config",
        "/run/secrets/kafka_client_properties",
    ]
    topic = "riverbank-hackathon.smoke-" + uuid.uuid4().hex
    key = "riverbank-hackathon:smoke:" + uuid.uuid4().hex
    message = json.dumps({"kind": "infrastructure-smoke", "id": uuid.uuid4().hex})
    redis_shell = ["exec", "-T", "redis", "sh", "-ec"]
    authenticate = (
        'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; '
        "redis-cli --no-auth-warning --user riverbank "
    )
    created = False
    try:
        command(
            *broker,
            "/opt/kafka/bin/kafka-topics.sh",
            *client,
            "--create",
            "--topic",
            topic,
            "--partitions",
            "1",
            "--replication-factor",
            "1",
            "--config",
            "retention.ms=3600000",
        )
        created = True
        command(
            *broker,
            "/opt/kafka/bin/kafka-console-producer.sh",
            "--bootstrap-server",
            "kafka:9092",
            "--topic",
            topic,
            "--producer.config",
            "/run/secrets/kafka_client_properties",
            data=message + "\n",
        )
        assert (
            command(*redis_shell, authenticate + f"SET {key} persistence-check EX 600")
            == "OK"
        )

        assert "NOAUTH" in command(
            "exec", "-T", "redis", "redis-cli", "ping", success=False
        )
        denied = command(
            *redis_shell, authenticate + "GET outside-project-key", success=False
        )
        assert "NOPERM" in denied

        # Restart services without removing volumes; validate durable data afterward.
        command("restart", "kafka", "redis")
        command("up", "-d", "--wait", "--wait-timeout", "240", "kafka", "redis")
        received = command(
            *broker,
            "/opt/kafka/bin/kafka-console-consumer.sh",
            "--bootstrap-server",
            "kafka:9092",
            "--topic",
            topic,
            "--consumer.config",
            "/run/secrets/kafka_client_properties",
            "--from-beginning",
            "--max-messages",
            "1",
            "--timeout-ms",
            "15000",
        )
        assert received == message, "Kafka message did not survive restart"
        assert command(*redis_shell, authenticate + f"GET {key}") == "persistence-check"
        redis_configuration = None
        for service in ("kafka", "redis"):
            container = command("ps", "-q", service)
            inspect = subprocess.check_output(
                ["docker", "inspect", container], text=True
            )
            configuration = json.loads(inspect)[0]
            if service == "redis":
                redis_configuration = configuration
            assert not configuration["HostConfig"].get("PortBindings")
        if api_image:
            assert redis_configuration is not None
            network = next(
                name
                for name in redis_configuration["NetworkSettings"]["Networks"]
                if name.endswith("_services")
            )
            secret_directory = next(
                Path(mount["Source"]).parent
                for mount in redis_configuration["Mounts"]
                if mount["Destination"] == "/run/secrets/redis_password"
            )
            probe = (
                "from api.config import Settings; "
                "from api.readiness import check_services; "
                "result=check_services(Settings(_env_file=None)); "
                "assert result=={'redis':'ok','kafka':'ok'}, result; "
                "print('PASS Python service clients')"
            )
            arguments = [
                "docker",
                "run",
                "--rm",
                "--platform",
                "linux/arm64",
                "--network",
                network,
                "--memory",
                "256m",
                "--read-only",
                "--cap-drop",
                "ALL",
                "-e",
                "KAFKA_BOOTSTRAP_SERVERS=kafka:9092",
                "-e",
                "REDIS_HOST=redis",
                "-e",
                "AWS_EC2_METADATA_DISABLED=true",
            ]
            for service in ("kafka", "redis"):
                target = f"/run/secrets/{service}_password"
                arguments.extend(
                    [
                        "-v",
                        f"{secret_directory / (service + '_password')}:{target}:ro",
                        "-e",
                        f"{service.upper()}_PASSWORD_FILE={target}",
                    ]
                )
            result = subprocess.run(
                [*arguments, api_image, "python", "-c", probe],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode:
                error = result.stderr
                for service in ("kafka", "redis"):
                    password = (
                        (secret_directory / f"{service}_password").read_text().strip()
                    )
                    error = error.replace(password, "<redacted>")
                print(error[-3000:], flush=True)
                raise RuntimeError(
                    "Python API clients could not authenticate to services"
                )
            print(result.stdout.strip())
        print(
            "PASS Kafka produce/consume, Redis ACL, "
            "unpublished ports and restart persistence"
        )
    finally:
        command(*redis_shell, authenticate + f"DEL {key}", success=False)
        if created:
            command(
                *broker,
                "/opt/kafka/bin/kafka-topics.sh",
                *client,
                "--delete",
                "--topic",
                topic,
                success=False,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--existing", action="store_true")
    parser.add_argument("--directory", type=Path, default=ROOT / "infra")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--project", default="riverbank-hackathon")
    parser.add_argument("--api-image")
    parser.add_argument(
        "--platform", choices=["linux/arm64", "linux/amd64"], default="linux/arm64"
    )
    args = parser.parse_args()
    environment = os.environ.copy()
    environment["COMPOSE_PROGRESS"] = "quiet"
    environment.setdefault("API_IMAGE", "riverbank-hackathon:base-01")
    environment.setdefault("SITE_ADDRESS", "localhost")
    compose = ["docker", "compose", "--project-name", args.project]
    if args.env_file:
        compose.extend(["--env-file", str(args.env_file)])
    compose.extend(["-f", str(args.directory / "compose.yaml")])
    if args.existing:
        if (args.directory / "compose.aws.yaml").exists():
            compose.extend(["-f", str(args.directory / "compose.aws.yaml")])
        verify(compose, environment, args.api_image)
        return
    # Isolated local/CI project: never target the production project by default.
    compose[3] = "riverbank-smoke-" + uuid.uuid4().hex[:10]
    with tempfile.TemporaryDirectory(prefix="riverbank-service-secrets-") as temporary:
        materialize(Path(temporary), cloud=False, region="ap-southeast-1")
        override = Path(temporary) / "platform.json"
        override.write_text(
            json.dumps(
                {
                    "services": {
                        name: {"platform": args.platform} for name in ("kafka", "redis")
                    }
                }
            )
        )
        compose.extend(["-f", str(override)])
        environment["SERVICE_SECRETS_DIR"] = temporary
        try:
            subprocess.run(
                [
                    *compose,
                    "up",
                    "-d",
                    "--wait",
                    "--wait-timeout",
                    "240",
                    "kafka",
                    "redis",
                ],
                env=environment,
                check=True,
                timeout=360,
            )
            verify(compose, environment, args.api_image)
        except Exception:
            logs = subprocess.run(
                [*compose, "logs", "--no-color", "--tail", "25", "kafka", "redis"],
                env=environment,
                capture_output=True,
                text=True,
                timeout=15,
            ).stdout
            for service in ("kafka", "redis"):
                password = (Path(temporary) / f"{service}_password").read_text().strip()
                logs = logs.replace(password, "<redacted>")
            print(logs, flush=True)
            raise
        finally:
            # Retain named volumes even for smoke projects; no recursive deletion.
            subprocess.run([*compose, "down"], env=environment, check=False, timeout=60)


if __name__ == "__main__":
    main()
