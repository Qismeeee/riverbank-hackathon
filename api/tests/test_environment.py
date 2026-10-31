"""Smoke test for the reproducible development environment."""

import sys

import pytest

from api.config import settings_from_environment


def test_supported_python_version() -> None:
    assert sys.version_info[:2] == (3, 12)


def test_cors_origins_require_explicit_origins(monkeypatch):
    monkeypatch.delenv("RIVERBANK_CORS_ORIGINS", raising=False)
    assert settings_from_environment().cors_origins == ()
    monkeypatch.setenv("RIVERBANK_CORS_ORIGINS", "http://localhost:5173, https://demo.example")
    assert settings_from_environment().cors_origins == (
        "http://localhost:5173",
        "https://demo.example",
    )
    for value in ("*", "https://example.com/path", "https://example.com,"):
        monkeypatch.setenv("RIVERBANK_CORS_ORIGINS", value)
        with pytest.raises(ValueError):
            settings_from_environment()
