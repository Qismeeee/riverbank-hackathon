import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.config import Settings
from api.main import create_app


def cloud_settings(**overrides):
    return Settings(
        environment="production",
        db_host="database.example.test",
        db_name="riverbank",
        db_secret_id="test-secret",
        db_sslrootcert="/test/rds-ca.pem",
        s3_bucket="test-bucket",
        **overrides,
    )


@pytest.fixture
def dependencies(monkeypatch):
    session = MagicMock()
    secrets = MagicMock()
    secrets.get_secret_value.return_value = {
        "SecretString": json.dumps({"username": "test", "password": "private-password"})
    }
    s3 = MagicMock()
    session.client.side_effect = lambda name, **kwargs: {
        "secretsmanager": secrets,
        "s3": s3,
    }[name]
    factory = MagicMock(return_value=session)
    connect = MagicMock()
    connect.return_value.execute.return_value.fetchone.return_value = (1,)
    monkeypatch.setattr("api.readiness.boto3.Session", factory)
    monkeypatch.setattr("api.readiness.psycopg.connect", connect)
    return factory, secrets, s3, connect


def test_local_readiness_never_contacts_cloud(dependencies):
    factory, _, _, connect = dependencies
    with TestClient(create_app(Settings())) as client:
        response = client.get("/ready")
    assert response.json() == {"status": "ok", "checks": {}}
    factory.assert_not_called()
    connect.assert_not_called()


def test_production_readiness_checks_tls_readonly_database_and_bucket(dependencies):
    factory, secret, s3, connect = dependencies
    with TestClient(create_app(cloud_settings())) as client:
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"] == {"database": "ok", "s3": "ok"}
    assert response.headers["cache-control"] == "no-store"
    factory.assert_called_once_with(profile_name=None, region_name="ap-southeast-1")
    secret.get_secret_value.assert_called_once_with(SecretId="test-secret")
    parameters = connect.call_args.kwargs
    assert parameters["sslmode"] == "verify-full"
    assert parameters["sslrootcert"] == "/test/rds-ca.pem"
    assert "default_transaction_read_only=on" in parameters["options"]
    connect.return_value.execute.assert_called_once_with("SELECT 1")
    s3.head_bucket.assert_called_once_with(Bucket="test-bucket")


@pytest.mark.parametrize("failure", ["database", "s3", "session"])
def test_unavailable_dependency_returns_503_without_leaking_secrets(
    dependencies, failure, caplog
):
    factory, _, s3, connect = dependencies
    target = {"database": connect, "s3": s3.head_bucket, "session": factory}[failure]
    target.side_effect = RuntimeError("private-password private-database-url")
    with TestClient(create_app(cloud_settings())) as client:
        response = client.get("/ready")
        assert client.get("/health").status_code == 200
    assert response.status_code == 503
    assert response.json()["status"] == "unavailable"
    assert "private-password" not in response.text + caplog.text
    assert "private-database-url" not in response.text + caplog.text


def test_missing_cloud_configuration_fails_closed(dependencies):
    _, secret, s3, connect = dependencies
    with TestClient(create_app(Settings(environment="production"))) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert set(response.json()["checks"].values()) == {"unavailable"}
    connect.assert_not_called()
    secret.get_secret_value.assert_not_called()
    s3.head_bucket.assert_not_called()


def test_readiness_reads_rotated_secret_on_next_probe(dependencies):
    _, secret, _, connect = dependencies
    with TestClient(create_app(cloud_settings())) as client:
        assert client.get("/ready").status_code == 200
        secret.get_secret_value.return_value = {
            "SecretString": json.dumps({"username": "test", "password": "rotated"})
        }
        assert client.get("/ready").status_code == 200
    assert connect.call_args.kwargs["password"] == "rotated"


def test_dev_url_preserves_tunnel_and_requires_verified_tls(dependencies):
    _, secret, _, connect = dependencies
    settings = cloud_settings(
        database_url="postgresql://test@db.test:15432/test?hostaddr=127.0.0.1"
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/ready").status_code == 200
    assert "hostaddr=127.0.0.1" in connect.call_args.args[0]
    assert connect.call_args.kwargs["sslmode"] == "verify-full"
    secret.get_secret_value.assert_not_called()
