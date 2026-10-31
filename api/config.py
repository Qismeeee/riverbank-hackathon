"""Minimal API configuration; integrations remain disabled until configured safely."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit

from api.runtime_config import Settings, get_settings

__all__ = ["ApiSettings", "Settings", "get_settings", "settings_from_environment"]


@dataclass(frozen=True)
class ApiSettings:
    """CORS origins are explicit and supplied by the application operator."""

    cors_origins: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            try:
                port = parsed.port
            except ValueError as exc:
                raise ValueError("invalid CORS origin") from exc
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
                or (port is not None and port == 0)
            ):
                raise ValueError("CORS origins must be explicit HTTP(S) origins")


def settings_from_environment() -> ApiSettings:
    """Allow only explicitly configured browser origins; default to no CORS."""
    raw = os.environ.get("RIVERBANK_CORS_ORIGINS", "")
    if not raw.strip():
        return ApiSettings()
    origins = tuple(origin.strip() for origin in raw.split(","))
    return ApiSettings(cors_origins=origins)
