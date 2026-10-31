"""Forward a local port to private RDS through the configured EC2 host."""

import subprocess

from api.config import Settings, get_settings


def ssh_command(settings: Settings) -> list[str]:
    if not all(
        (
            settings.ssh_host,
            settings.ssh_key_file,
            settings.ssh_known_hosts_file,
            settings.db_host,
        )
    ):
        raise ValueError(
            "Configure SSH_HOST, SSH_KEY_FILE, SSH_KNOWN_HOSTS_FILE and DB_HOST"
        )
    return [
        "ssh",
        "-N",
        "-T",
        "-i",
        str(settings.ssh_key_file.resolve()),
        "-L",
        f"127.0.0.1:{settings.db_local_port}:{settings.db_host}:{settings.db_port}",
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
        f"{settings.ssh_user}@{settings.ssh_host}",
    ]


if __name__ == "__main__":
    try:
        subprocess.run(ssh_command(get_settings()), check=True)
    except KeyboardInterrupt:
        pass
