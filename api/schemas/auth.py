"""Response contract for the authenticated identity endpoint."""

from typing import Literal

from pydantic import BaseModel

from api.security.auth import Role


class SellerScopedGrantResponse(BaseModel):
    role: Literal[Role.SELLER]
    seller_id: str
    shop_id: str


class AuthMeResponse(BaseModel):
    issuer: str
    subject: str
    roles: list[Role]
    scoped_grants: list[SellerScopedGrantResponse]
