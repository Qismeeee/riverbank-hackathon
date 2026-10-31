"""Application configuration; loading settings never contacts external services."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RIVERBANK_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    app_name: str = Field(default="Riverbank Hackathon API", min_length=1)
    environment: Literal["local", "test", "production"] = "local"
    host: str = Field(default="127.0.0.1", min_length=1)
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"


@lru_cache
def get_settings() -> Settings:
    return Settings()
