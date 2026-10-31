"""Keep BASE-01 tests independent of local secrets and external networks."""

import os
import socket

import pytest


@pytest.fixture(autouse=True)
def offline_environment(monkeypatch: pytest.MonkeyPatch, tmp_path):
    from api.config import get_settings

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    for name in os.environ:
        if name.startswith(("RIVERBANK_", "KAFKA_", "REDIS_", "COGNITO_")):
            monkeypatch.delenv(name)
    for name in (
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_PROFILE",
        "AWS_REGION",
        "DATABASE_URL",
        "DB_HOST",
        "DB_PORT",
        "DB_NAME",
        "DB_SECRET_ID",
        "DB_SSLROOTCERT",
        "DB_LOCAL_PORT",
        "SSH_HOST",
        "SSH_USER",
        "SSH_KEY_FILE",
        "SSH_KNOWN_HOSTS_FILE",
        "ALLOWED_ORIGINS",
        "S3_BUCKET",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "OPENROUTER_API_KEY",
        "ADDLIVETAG_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)

    def deny_network(*args, **kwargs):
        pytest.fail("Offline tests must not open network connections")

    original_connect = socket.socket.connect

    def connect_local_only(connection, address):
        # Windows asyncio uses a loopback socketpair for its internal wakeup pipe.
        if connection.family == getattr(socket, "AF_UNIX", None) or (
            isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1"}
        ):
            return original_connect(connection, address)
        deny_network()

    monkeypatch.setattr(socket, "create_connection", deny_network)
    monkeypatch.setattr(socket.socket, "connect", connect_local_only)
    monkeypatch.setattr(socket.socket, "connect_ex", deny_network)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
