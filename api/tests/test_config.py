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
