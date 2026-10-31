"""Read current application grants from PostgreSQL after token verification.

This adapter does not verify tokens, provision users, or check source consent.
The connection must target the authoritative database with a read-only runtime
identity. It is deliberately not enabled by the default application.
"""

from collections.abc import Callable

import psycopg

from api.security.auth import AuthUnavailable, Grants, Identity, Role, ScopedGrant
from api.services.foundation.underwriting.sources import Scope

_CURRENT_GRANTS = """
SELECT r.role::text, s.seller_id::text, s.external_shop_ref
FROM public.auth_identities AS i
JOIN public.identity_roles AS r ON r.identity_id = i.identity_id
LEFT JOIN public.seller_access_grants AS g
    ON g.role_assignment_id = r.role_assignment_id
    AND g.role = 'seller' AND r.role = 'seller'
    AND g.granted_at <= statement_timestamp()
    AND (g.expires_at IS NULL OR statement_timestamp() < g.expires_at)
    AND (g.revoked_at IS NULL OR statement_timestamp() < g.revoked_at)
LEFT JOIN public.sellers AS s ON s.seller_id = g.seller_id
WHERE i.issuer = %s COLLATE "C" AND i.subject = %s COLLATE "C"
    AND i.is_enabled
    AND r.granted_at <= statement_timestamp()
    AND (r.expires_at IS NULL OR statement_timestamp() < r.expires_at)
    AND (r.revoked_at IS NULL OR statement_timestamp() < r.revoked_at)
"""


def _connect() -> psycopg.Connection:
    return psycopg.connect(connect_timeout=3)


class PostgresGrantResolver:
    """Read once per resolution; never cache or infer rights from token claims."""

    def __init__(self, connect: Callable[[], psycopg.Connection] = _connect) -> None:
        self._connect = connect

    def resolve(self, identity: Identity) -> Grants:
        try:
            with self._connect() as connection:
                rows = connection.execute(_CURRENT_GRANTS, (identity.issuer, identity.subject))
                roles: set[Role] = set()
                scoped: set[ScopedGrant] = set()
                for role_value, seller_id, shop_id in rows:
                    role = Role(role_value)
                    roles.add(role)
                    if seller_id is not None or shop_id is not None:
                        if role != Role.SELLER or not seller_id or not shop_id:
                            raise ValueError("invalid seller grant row")
                        scoped.add(ScopedGrant(role, Scope(seller_id, shop_id)))
                return Grants(frozenset(roles), frozenset(scoped))
        except (psycopg.Error, ValueError, TypeError) as exc:
            raise AuthUnavailable("grant source unavailable or invalid") from exc
