"""Forward private RDS or Docker services through the configured EC2 host."""

import argparse
import ipaddress
import subprocess

from api.config import Settings, get_settings


def ssh_command(settings: Settings, *, services_only: bool = False) -> list[str]:
    if not all(
        (
            settings.ssh_host,
            settings.ssh_key_file,
            settings.ssh_known_hosts_file,
            settings.db_host if not services_only else True,
        )
    ):
        raise ValueError(
            "Configure SSH_HOST, SSH_KEY_FILE, SSH_KNOWN_HOSTS_FILE "
            "and DB_HOST for a database tunnel"
        )
    base = [
        "ssh",
        "-i",
        str(settings.ssh_key_file.resolve()),
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        f"UserKnownHostsFile={settings.ssh_known_hosts_file.resolve()}",
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        "ConnectTimeout=10",
        "-o",
        "ServerAliveInterval=30",
        "-o",
        "ServerAliveCountMax=3",
    ]
    target = f"{settings.ssh_user}@{settings.ssh_host}"
    if services_only:
        # Resolve internal addresses instead of publishing service ports.
        result = subprocess.run(
            [
                *base,
                target,
                "docker inspect --format "
                "'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "
                "riverbank-hackathon-kafka-1 riverbank-hackathon-redis-1",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        )
        addresses = result.stdout.split()
        if len(addresses) != 2 or not all(
            ipaddress.ip_address(address).is_private for address in addresses
        ):
            raise ValueError("Expected two private service container addresses")
        forwards = [
            f"127.0.0.1:19092:{addresses[0]}:19092",
            f"127.0.0.1:16379:{addresses[1]}:6379",
        ]
    else:
        forwards = [
            f"127.0.0.1:{settings.db_local_port}:{settings.db_host}:{settings.db_port}"
        ]
    return [
        *base,
        "-N",
        "-T",
        *[argument for forward in forwards for argument in ("-L", forward)],
        target,
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--services",
        action="store_true",
        help="Forward Kafka/Redis through their private container IPs",
    )
    args = parser.parse_args()
    try:
        subprocess.run(
            ssh_command(get_settings(), services_only=args.services), check=True
        )
    except KeyboardInterrupt:
        pass
