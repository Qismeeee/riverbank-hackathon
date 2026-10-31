from unittest.mock import MagicMock

import pytest

from api.config import Settings
from api.readiness import check_dependencies, check_services
from scripts.service_secrets import materialize


def configured(**overrides):
    return Settings(
        redis_host="redis",
        redis_password="redis-private-password",
        kafka_bootstrap_servers="kafka:9092",
        kafka_password="kafka-private-password",
        **overrides,
    )


def test_local_readiness_does_not_connect_to_services():
    assert check_dependencies(configured()) == {}


def test_services_use_authenticated_clients_and_close_connections(monkeypatch):
    redis = MagicMock()
    redis.return_value.__enter__.return_value.ping.return_value = True
    kafka = MagicMock()
    kafka.return_value.describe_cluster.return_value = {"brokers": ["broker"]}
    monkeypatch.setattr("api.readiness.Redis", redis)
    monkeypatch.setattr("api.readiness.KafkaAdminClient", kafka)
    assert check_services(configured()) == {"redis": "ok", "kafka": "ok"}
    assert redis.call_args.kwargs["username"] == "riverbank"
    assert kafka.call_args.kwargs["security_protocol"] == "SASL_PLAINTEXT"
    assert kafka.call_args.kwargs["sasl_plain_password"] == "kafka-private-password"
    kafka.return_value.close.assert_called_once()


@pytest.mark.parametrize("service", ["Redis", "KafkaAdminClient"])
def test_service_failure_does_not_leak_credentials(monkeypatch, caplog, service):
    redis = MagicMock()
    redis.return_value.__enter__.return_value.ping.return_value = True
    kafka = MagicMock()
    kafka.return_value.describe_cluster.return_value = {"brokers": ["broker"]}
    monkeypatch.setattr("api.readiness.Redis", redis)
    monkeypatch.setattr("api.readiness.KafkaAdminClient", kafka)
    target = redis if service == "Redis" else kafka
    target.side_effect = RuntimeError("redis-private-password kafka-private-password")
    checks = check_services(configured())
    assert checks["redis" if service == "Redis" else "kafka"] == "unavailable"
    assert "private-password" not in caplog.text


def test_materialized_credentials_are_separate_stable_and_acl_scoped(tmp_path):
    directory = tmp_path / "secrets"
    materialize(directory, cloud=False, region="ap-southeast-1")
    kafka = (directory / "kafka_password").read_text().strip()
    redis = (directory / "redis_password").read_text().strip()
    assert kafka != redis
    materialize(directory, cloud=False, region="ap-southeast-1")
    assert (directory / "kafka_password").read_text().strip() == kafka
    assert kafka in (directory / "kafka_client_properties").read_text()
    acl = (directory / "redis_acl").read_text()
    assert "user default off" in acl
    assert "~riverbank-hackathon:*" in acl
    assert "-@dangerous" in acl
    assert redis not in acl


def test_passwords_are_hidden_in_settings():
    assert "private-password" not in repr(configured())
