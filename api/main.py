"""Minimal HTTP application for BASE-01."""

from typing import Literal

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.config import Settings, get_settings
from api.readiness import check_dependencies


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    checks: dict[str, str]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    application = FastAPI(title=settings.app_name)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @application.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        """Report process liveness; no database or provider readiness is implied."""
        return HealthResponse()

    @application.get("/ready", response_model=ReadinessResponse)
    def ready(response: Response) -> ReadinessResponse:
        checks = check_dependencies(settings)
        available = all(value == "ok" for value in checks.values())
        response.status_code = 200 if available else 503
        response.headers["Cache-Control"] = "no-store"
        return ReadinessResponse(
            status="ok" if available else "unavailable", checks=checks
        )

    return application


app = create_app()
