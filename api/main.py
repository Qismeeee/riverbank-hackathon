"""Minimal HTTP application for BASE-01."""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from api.config import Settings, get_settings


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    application = FastAPI(title=settings.app_name)

    @application.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        """Report process liveness; no database or provider readiness is implied."""
        return HealthResponse()

    return application


app = create_app()
