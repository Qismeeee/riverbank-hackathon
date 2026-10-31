"""Fail-closed HTTP foundation; no identity provider or workflow is configured."""

from typing import Annotated

from fastapi import FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.config import ApiSettings
from api.security.auth import AuthService, AuthUnavailable, InvalidAccessToken

_bearer = HTTPBearer(auto_error=False)


def create_app(
    settings: ApiSettings | None = None, *, auth_service: AuthService | None = None
) -> FastAPI:
    settings = settings or ApiSettings()
    app = FastAPI(title="Riverbank API")
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        )

    @app.get("/v1/auth/me")
    def auth_me(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)],
    ) -> dict:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bearer access token required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if auth_service is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "AUTH_NOT_CONFIGURED",
                    "details": "Identity provider not configured",
                },
            )
        try:
            principal = auth_service.authenticate(credentials.credentials)
        except InvalidAccessToken:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        except AuthUnavailable:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "AUTH_UNAVAILABLE", "details": "Authentication unavailable"},
            ) from None
        return {
            "issuer": principal.identity.issuer,
            "subject": principal.identity.subject,
            "roles": sorted(principal.grants.roles),
            "scoped_grants": [
                {
                    "role": grant.role,
                    "seller_id": grant.scope.seller_id,
                    "shop_id": grant.scope.shop_id,
                }
                for grant in sorted(
                    principal.grants.scoped,
                    key=lambda grant: (grant.role, grant.scope.seller_id, grant.scope.shop_id),
                )
            ],
        }

    return app


app = create_app()
