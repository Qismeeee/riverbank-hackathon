"""Reusable HTTP authentication and authorization dependencies.

Authorization results are request-local and are not a substitute for rechecking
and locking rights in a transaction when a protected write is performed.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.security.auth import AuthUnavailable, InvalidAccessToken, Principal, Role
from api.services.underwriting.sources import Scope

_bearer = HTTPBearer(auto_error=False)


def current_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)],
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    auth_service = request.app.state.auth_service
    if auth_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AUTH_NOT_CONFIGURED", "details": "Identity provider not configured"},
        )
    try:
        return auth_service.authenticate(credentials.credentials)
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


def require_underwriter(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
    """Require the platform role; callers must still verify resource linkage."""
    if not principal.is_underwriter():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Underwriter required")
    return principal


def require_seller_ownership(principal: Principal, scope: Scope) -> None:
    """Check a server-resolved scope; this neither loads the resource nor checks consent."""
    if not principal.owns_seller_shop(scope):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seller scope required")


def require_seller(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
    """Require a server-assigned seller role; resource ownership is a separate check."""
    if Role.SELLER not in principal.grants.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seller required")
    return principal


def require_seller_or_underwriter(
    principal: Annotated[Principal, Depends(current_principal)],
) -> Principal:
    """Role gate only; seller resource ownership must be checked before access."""
    if Role.SELLER not in principal.grants.roles and not principal.is_underwriter():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role required")
    return principal
