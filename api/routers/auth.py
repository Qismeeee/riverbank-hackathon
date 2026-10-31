"""Authenticated identity routes."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.schemas.auth import AuthMeResponse
from api.security.auth import Principal
from api.security.dependencies import current_principal

router = APIRouter()


@router.get("/v1/auth/me", response_model=AuthMeResponse)
def auth_me(principal: Annotated[Principal, Depends(current_principal)]) -> dict:
    """Return server-assigned roles for the authenticated user.

    A user may have both seller and underwriter roles. Seller shop access is
    limited to scoped grants; the underwriter role is platform-wide.
    """
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
