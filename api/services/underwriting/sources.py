"""Consent-gated access to scoped, synthetic payout data.

The in-memory authorization and fixture stores are demo infrastructure, not an
identity system or evidence of a real marketplace integration.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol


class SourceAccessDenied(Exception):
    """The seller/shop or consent does not authorize the requested read."""


class SourceDataError(Exception):
    """The source returned missing, malformed, or out-of-scope data."""


@dataclass(frozen=True)
class Scope:
    seller_id: str
    shop_id: str

    def __post_init__(self) -> None:
        if not self.seller_id.strip() or not self.shop_id.strip():
            raise ValueError("seller_id and shop_id are required")


@dataclass(frozen=True)
class Consent:
    scope: Scope
    purpose: str
    granted_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    def __post_init__(self) -> None:
        times = (self.granted_at, self.expires_at, self.revoked_at)
        if any(t is not None and (t.tzinfo is None or t.utcoffset() is None) for t in times):
            raise ValueError("consent timestamps must include a timezone")
        if not self.purpose.strip() or self.expires_at <= self.granted_at:
            raise ValueError("invalid consent purpose or validity period")

    def permits(self, scope: Scope, purpose: str, now: datetime) -> bool:
        return (
            self.scope == scope
            and self.purpose == purpose
            and self.granted_at <= now < self.expires_at
            and (self.revoked_at is None or now < self.revoked_at)
        )


@dataclass(frozen=True)
class Payout:
    week_start: date
    amount_vnd: int

    def __post_init__(self) -> None:
        if type(self.week_start) is not date:
            raise ValueError("week_start must be a date")
        if type(self.amount_vnd) is not int or self.amount_vnd < 0:
            raise ValueError("payout must be a non-negative integer VND amount")


@dataclass(frozen=True)
class SourceRecord:
    scope: Scope
    payouts: tuple[Payout, ...]
    platform_supported_amount_vnd: int
    source_id: str
    synthetic: bool

    def __post_init__(self) -> None:
        if not self.source_id.strip() or type(self.synthetic) is not bool:
            raise ValueError("source provenance and synthetic label are required")
        if (
            type(self.platform_supported_amount_vnd) is not int
            or self.platform_supported_amount_vnd < 0
        ):
            raise ValueError("platform support must be a non-negative integer VND amount")
        if not isinstance(self.payouts, tuple) or not all(
            isinstance(p, Payout) for p in self.payouts
        ):
            raise ValueError("payouts must be an immutable tuple of payout records")
        if len({p.week_start for p in self.payouts}) != len(self.payouts):
            raise ValueError("duplicate payout weeks")


@dataclass(frozen=True)
class Snapshot:
    record: SourceRecord
    purpose: str
    captured_at: datetime
    sha256: str


def snapshot_hash(record: SourceRecord, purpose: str, captured_at: datetime) -> str:
    """Hash canonical snapshot contents, including scope, provenance and capture time."""
    payload = {
        "seller_id": record.scope.seller_id,
        "shop_id": record.scope.shop_id,
        "payouts": [
            {"week_start": p.week_start.isoformat(), "amount_vnd": p.amount_vnd}
            for p in record.payouts
        ],
        "platform_supported_amount_vnd": record.platform_supported_amount_vnd,
        "source_id": record.source_id,
        "synthetic": record.synthetic,
        "purpose": purpose,
        "captured_at": captured_at.astimezone(UTC).isoformat(),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class AuthorizationStore(Protocol):
    def owns_shop(self, scope: Scope) -> bool: ...

    def has_consent(self, scope: Scope, purpose: str, now: datetime) -> bool: ...


class PayoutSource(Protocol):
    def read(self, scope: Scope) -> SourceRecord: ...


class ScopedPayoutReader:
    """Only entry point for application reads; the caller must authenticate actor_scope."""

    def __init__(self, authorization: AuthorizationStore, source: PayoutSource) -> None:
        self._authorization = authorization
        self._source = source

    def snapshot(self, actor_scope: Scope, requested_scope: Scope, purpose: str) -> Snapshot:
        now = datetime.now(UTC)
        if (
            actor_scope != requested_scope
            or not self._authorization.owns_shop(requested_scope)
            or not self._authorization.has_consent(requested_scope, purpose, now)
        ):
            raise SourceAccessDenied("seller/shop scope or consent invalid")
        record = self._source.read(requested_scope)
        if not isinstance(record, SourceRecord) or record.scope != requested_scope:
            raise SourceDataError("source returned invalid or out-of-scope data")
        captured_at = datetime.now(UTC)
        if not self._authorization.owns_shop(
            requested_scope
        ) or not self._authorization.has_consent(requested_scope, purpose, captured_at):
            raise SourceAccessDenied("seller/shop scope or consent invalid after source read")
        return Snapshot(record, purpose, captured_at, snapshot_hash(record, purpose, captured_at))


class InMemoryAuthorization:
    """Mutable demo store; changes take effect on the next read."""

    def __init__(self, shops: set[Scope], consents: list[Consent]) -> None:
        self.shops = set(shops)
        self.consents = list(consents)

    def owns_shop(self, scope: Scope) -> bool:
        return scope in self.shops

    def has_consent(self, scope: Scope, purpose: str, now: datetime) -> bool:
        return any(c.permits(scope, purpose, now) for c in self.consents)


class SyntheticPayoutSource:
    """Offline fixtures only; not a marketplace adapter."""

    def __init__(self, records: tuple[SourceRecord, ...]) -> None:
        self._records: dict[Scope, SourceRecord] = {}
        for record in records:
            if not record.synthetic or record.scope in self._records:
                raise ValueError("fixtures must be synthetic and uniquely scoped")
            self._records[record.scope] = record

    def read(self, scope: Scope) -> SourceRecord:
        try:
            return self._records[scope]
        except KeyError:
            raise SourceDataError("no synthetic data for seller/shop") from None
