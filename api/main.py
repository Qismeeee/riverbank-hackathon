"""Fail-closed HTTP foundation; authentication requires trusted server configuration."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import ApiSettings, Settings, get_settings, settings_from_environment
from api.routers import auth, cases, health, runtime_health, statements
from api.routers.foundation import copilot, studio, underwriting
from api.security.auth import AuthService
from api.security.auth0 import Auth0AccessTokenVerifier
from api.security.postgres_grants import PostgresGrantResolver


def auth_from_environment() -> AuthService | None:
    """Enable Auth0 only when the complete trusted server configuration is present."""
    issuer = os.environ.get("AUTH0_ISSUER", "")
    audience = os.environ.get("AUTH0_AUDIENCE", "")
    client_id = os.environ.get("AUTH0_CLIENT_ID", "")
    if not all((issuer, audience, client_id)) or not all(
        os.environ.get(key) for key in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD")
    ):
        return None
    return AuthService(
        Auth0AccessTokenVerifier(issuer, audience, client_id), PostgresGrantResolver()
    )


def create_app(
    settings: ApiSettings | Settings | None = None, *, auth_service: AuthService | None = None
) -> FastAPI:
    runtime_settings = settings if isinstance(settings, Settings) else get_settings()
    origins = (
        ApiSettings(tuple(settings.allowed_origins))
        if isinstance(settings, Settings)
        else (settings or ApiSettings())
    )
    app = FastAPI(title="Riverbank API")
    app.state.runtime_settings = runtime_settings
    app.state.auth_service = auth_service

    if origins.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(origins.cors_origins),
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        )

    app.include_router(health.router)
    app.include_router(runtime_health.router)
    app.include_router(auth.router)
    app.include_router(cases.router)
    app.include_router(copilot.router)
    app.include_router(underwriting.router)
    app.include_router(statements.router)
    app.include_router(studio.router)

    return app


app = create_app(settings_from_environment(), auth_service=auth_from_environment())
