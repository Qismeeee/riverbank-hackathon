"""Provider-neutral authentication and authorization boundaries.

Implementations must be trusted server-side dependencies. A verifier must validate
an API access token against the agreed issuer contract, not merely decode a JWT.
Grants must come from an authoritative source, not request fields or token claims
whose use for authorization has not been agreed.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from api.services.underwriting.sources import Scope


class InvalidAccessToken(Exception):
    """The provider has established that the access token is invalid."""


class AuthUnavailable(Exception):
    """The provider or authoritative grant source cannot be checked."""


class Role(StrEnum):
    SELLER = "seller"
    UNDERWRITER = "underwriter"


@dataclass(frozen=True)
class Identity:
    issuer: str
    subject: str

    def __post_init__(self) -> None:
        if not self.issuer.strip() or not self.subject.strip():
            raise ValueError("issuer and subject are required")


@dataclass(frozen=True)
class ScopedGrant:
    role: Role
    scope: Scope

    def __post_init__(self) -> None:
        if not isinstance(self.role, Role) or not isinstance(self.scope, Scope):
            raise TypeError("scoped grant requires a role and seller/shop scope")
        if self.role is not Role.SELLER:
            raise ValueError("only seller ownership has a shop scope")


@dataclass(frozen=True)
class Grants:
    roles: frozenset[Role]
    scoped: frozenset[ScopedGrant]

    def __post_init__(self) -> None:
        if not isinstance(self.roles, frozenset) or not all(
            isinstance(role, Role) for role in self.roles
        ):
            raise ValueError("roles must be a frozenset of Role")
        if not isinstance(self.scoped, frozenset) or not all(
            isinstance(grant, ScopedGrant) and grant.role in self.roles for grant in self.scoped
        ):
            raise ValueError("scoped grants must refer to granted roles")


@dataclass(frozen=True)
class Principal:
    identity: Identity
    grants: Grants

    def is_underwriter(self) -> bool:
        """Check platform role; resource linkage and write-time checks remain separate."""
        return Role.UNDERWRITER in self.grants.roles

    def owns_seller_shop(self, scope: Scope) -> bool:
        """Check exact seller ownership, without conferring marketplace consent."""
        if not isinstance(scope, Scope):
            return False
        return ScopedGrant(Role.SELLER, scope) in self.grants.scoped

    def permits(self, role: Role, scope: Scope) -> bool:
        """Check platform underwriter role or exact seller ownership.

        Scope is required for compatibility but is not an underwriter grant.
        This does not check resource linkage, consent, or write-time permissions.
        """
        if role is Role.UNDERWRITER:
            return self.is_underwriter()
        if role is Role.SELLER:
            return self.owns_seller_shop(scope)
        return False


class AccessTokenVerifier(Protocol):
    def verify(self, access_token: str) -> Identity:
        """Validate signature/introspection, issuer, API audience and validity.

        Raise InvalidAccessToken for a rejected token or AuthUnavailable when
        verification cannot be completed. Never return identity from an ID token.
        """
        ...


class GrantResolver(Protocol):
    def resolve(self, identity: Identity) -> Grants:
        """Resolve current permissions by verified issuer and subject.

        Return empty grants for an unmapped identity and raise AuthUnavailable
        when permissions cannot be checked.
        """
        ...


@dataclass(frozen=True)
class AuthService:
    verifier: AccessTokenVerifier
    grants: GrantResolver

    def authenticate(self, access_token: str) -> Principal:
        identity = self.verifier.verify(access_token)
        if not isinstance(identity, Identity):
            raise AuthUnavailable("invalid verifier response")
        grants = self.grants.resolve(identity)
        if not isinstance(grants, Grants):
            raise AuthUnavailable("invalid grant response")
        return Principal(identity, grants)
