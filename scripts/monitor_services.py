"""Publish bounded dependency availability metrics from the EC2 host."""

import json
import subprocess
from urllib.error import URLError
from urllib.request import Request, urlopen


def run(arguments: list[str]) -> str:
    result = subprocess.run(arguments, capture_output=True, text=True, timeout=20)
    if result.returncode:
        raise RuntimeError("Infrastructure monitoring command failed")
    return result.stdout


def main() -> None:
    token = (
        urlopen(
            Request(
                "http://169.254.169.254/latest/api/token",
                method="PUT",
                headers={"X-aws-ec2-metadata-token-ttl-seconds": "60"},
            ),
            timeout=3,
        )
        .read()
        .decode()
    )
    instance = (
        urlopen(
            Request(
                "http://169.254.169.254/latest/meta-data/instance-id",
                headers={"X-aws-ec2-metadata-token": token},
            ),
            timeout=3,
        )
        .read()
        .decode()
    )
    containers = json.loads(
        run(
            [
                "docker",
                "inspect",
                "riverbank-hackathon-api-1",
                "riverbank-hackathon-kafka-1",
                "riverbank-hackathon-redis-1",
            ]
        )
    )
    statuses = {}
    for container in containers:
        service = container["Config"]["Labels"]["com.docker.compose.service"]
        statuses[service] = int(
            container["State"]["Running"]
            and container["State"].get("Health", {}).get("Status") == "healthy"
        )
    if statuses["api"]:
        try:
            from pathlib import Path

            domain = next(
                line.split("=", 1)[1].strip()
                for line in (
                    Path("/opt/riverbank-hackathon/.env").read_text().splitlines()
                )
                if line.startswith("SITE_ADDRESS=")
            )
            with urlopen(f"https://{domain}/ready", timeout=20) as response:
                status = json.load(response)
                statuses["api"] = int(
                    status.get("checks")
                    == {"database": "ok", "s3": "ok", "redis": "ok", "kafka": "ok"}
                )
        except (OSError, ValueError, StopIteration, URLError):
            statuses["api"] = 0
    metrics = [
        {
            "MetricName": "ServiceReady",
            "Value": value,
            "Unit": "Count",
            "Dimensions": [
                {"Name": "InstanceId", "Value": instance},
                {"Name": "Service", "Value": service},
            ],
        }
        for service, value in statuses.items()
    ]
    run(
        [
            "aws",
            "cloudwatch",
            "put-metric-data",
            "--region",
            "ap-southeast-1",
            "--namespace",
            "RiverbankHackathon/Host",
            "--metric-data",
            json.dumps(metrics),
        ]
    )
    print(json.dumps({"instance": instance, "ready": statuses}))


if __name__ == "__main__":
    main()
