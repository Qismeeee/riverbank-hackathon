"""Application configuration; loading settings never contacts external services."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RIVERBANK_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
        populate_by_name=True,
        hide_input_in_errors=True,
    )

    app_name: str = Field(default="Riverbank Hackathon API", min_length=1)
    environment: Literal["local", "test", "production", "cloud"] = Field(
        default="local",
        validation_alias=AliasChoices("RIVERBANK_ENVIRONMENT", "RIVERBANK_ENV"),
    )
    host: str = Field(default="127.0.0.1", min_length=1)
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias="ALLOWED_ORIGINS",
    )
    database_url: SecretStr | None = Field(
        default=None, validation_alias="DATABASE_URL"
    )
    db_host: str | None = Field(default=None, validation_alias="DB_HOST")
    db_port: int = Field(default=5432, ge=1, le=65535, validation_alias="DB_PORT")
    db_name: str | None = Field(default=None, validation_alias="DB_NAME")
    db_secret_id: str | None = Field(default=None, validation_alias="DB_SECRET_ID")
    db_sslrootcert: Path | None = Field(default=None, validation_alias="DB_SSLROOTCERT")
    db_local_port: int = Field(
        default=15432, ge=1, le=65535, validation_alias="DB_LOCAL_PORT"
    )
    aws_profile: str | None = Field(default=None, validation_alias="AWS_PROFILE")
    aws_region: str = Field(default="ap-southeast-1", validation_alias="AWS_REGION")
    s3_bucket: str | None = Field(default=None, validation_alias="S3_BUCKET")
    ssh_host: str | None = Field(default=None, validation_alias="SSH_HOST")
    ssh_user: str = Field(default="ubuntu", validation_alias="SSH_USER")
    ssh_key_file: Path | None = Field(default=None, validation_alias="SSH_KEY_FILE")
    ssh_known_hosts_file: Path | None = Field(
        default=None, validation_alias="SSH_KNOWN_HOSTS_FILE"
    )
    openai_api_key: SecretStr | None = Field(
        default=None, validation_alias="OPENAI_API_KEY"
    )
    anthropic_api_key: SecretStr | None = Field(
        default=None, validation_alias="ANTHROPIC_API_KEY"
    )
    openrouter_api_key: SecretStr | None = Field(
        default=None, validation_alias="OPENROUTER_API_KEY"
    )
    addlivetag_api_key: SecretStr | None = Field(
        default=None, validation_alias="ADDLIVETAG_API_KEY"
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            if value.lstrip().startswith("["):
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
