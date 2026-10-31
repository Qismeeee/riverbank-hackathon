import pytest
from pydantic import ValidationError

from api.config import Settings


def test_env_overrides_dotenv(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text("RIVERBANK_PORT=8100\n", encoding="utf-8")
    monkeypatch.setenv("RIVERBANK_PORT", "8200")

    assert Settings().port == 8200


def test_dotenv_is_optional_and_loaded_when_present(monkeypatch, tmp_path):
    monkeypatch.delenv("RIVERBANK_PORT", raising=False)
    assert Settings().port == 8000

    (tmp_path / ".env").write_text("RIVERBANK_PORT=8100\n", encoding="utf-8")
    assert Settings().port == 8100


@pytest.mark.parametrize("port", ["0", "65536", "invalid"])
def test_invalid_port_fails_before_startup(monkeypatch, port):
    monkeypatch.setenv("RIVERBANK_PORT", port)

    with pytest.raises(ValidationError):
        Settings()


def test_cloud_env_keeps_credentials_private(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text(
        "RIVERBANK_ENV=cloud\nAWS_PROFILE=riverbank\n"
        "AWS_REGION=ap-southeast-1\nS3_BUCKET=test-bucket\n"
        "DATABASE_URL=postgresql://test:fake-password@localhost/test\n"
        "OPENAI_API_KEY=fake-api-key\n",
        encoding="utf-8",
    )
    settings = Settings()

    assert settings.environment == "cloud"
    assert settings.aws_profile == "riverbank"
    assert settings.s3_bucket == "test-bucket"
    assert "fake-password" not in repr(settings)
    assert "fake-api-key" not in repr(settings)


@pytest.mark.parametrize(
    "origins",
    [
        "http://localhost:3000,http://localhost:3001",
        '["http://localhost:3000", "http://localhost:3001"]',
    ],
)
def test_origins_accept_csv_or_json(monkeypatch, origins):
    monkeypatch.setenv("ALLOWED_ORIGINS", origins)
    assert Settings().allowed_origins == [
        "http://localhost:3000",
        "http://localhost:3001",
    ]
