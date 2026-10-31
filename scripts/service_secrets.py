"""Materialize narrowly mounted service credentials; never print secret values."""

import argparse
import hashlib
import json
import os
import secrets
import subprocess
from pathlib import Path


def aws_password(service: str, region: str) -> str:
    result = subprocess.run(
        [
            "aws",
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            f"riverbank-hackathon/{service}",
            "--region",
            region,
            "--output",
            "json",
            "--no-cli-pager",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=20,
    )
    if result.returncode:
        raise RuntimeError(f"Cannot retrieve {service} credential from Secrets Manager")
    credential = json.loads(json.loads(result.stdout)["SecretString"])
    if credential.get("username") != "riverbank":
        raise ValueError("Unexpected service username")
    return credential["password"]


def materialize(directory: Path, *, cloud: bool, region: str) -> None:
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)

    def password(service: str) -> str:
        existing = directory / f"{service}_password"
        if cloud:
            return aws_password(service, region)
        return (
            existing.read_text().strip()
            if existing.exists()
            else secrets.token_urlsafe(32)
        )

    kafka = password("kafka")
    redis = password("redis")
    if any(character in kafka + redis for character in '\n\r"\\'):
        raise ValueError("Service credential contains unsupported control characters")
    credential = f'username="riverbank" password="{kafka}"'
    values = {
        "kafka_password": kafka + "\n",
        "redis_password": redis + "\n",
        "kafka_server_jaas": (
            "KafkaServer { org.apache.kafka.common.security.plain.PlainLoginModule "
            f'required {credential} user_riverbank="{kafka}"; }};\n'
        ),
        "kafka_client_properties": (
            "security.protocol=SASL_PLAINTEXT\nsasl.mechanism=PLAIN\n"
            "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule "
            f"required {credential};\n"
            "request.timeout.ms=10000\ndefault.api.timeout.ms=15000\n"
        ),
        "redis_acl": (
            "user default off\nuser riverbank on #"
            + hashlib.sha256(redis.encode()).hexdigest()
            + " ~riverbank-hackathon:* &riverbank-hackathon:* "
            "+@read +@write +@connection +@transaction +@scripting -@dangerous\n"
        ),
    }
    for name, value in values.items():
        temporary = directory / (name + ".tmp")
        temporary.write_text(value, encoding="utf-8")
        # The containing directory remains 0700 on the host. Containers receive
        # only their explicitly listed files, mounted read-only by Compose.
        temporary.chmod(0o444)
        os.replace(temporary, directory / name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--aws", action="store_true")
    parser.add_argument("--region", default="ap-southeast-1")
    arguments = parser.parse_args()
    materialize(arguments.directory, cloud=arguments.aws, region=arguments.region)
    print("Service credential files prepared; values omitted")
