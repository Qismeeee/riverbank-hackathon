"""Process-local synthetic source repository; not an authentication boundary.

All grants, revocations and captures must use this same instance. The lock
serializes revocation with the entire offline read and snapshot insert. A real
adapter needs a durable transaction and a separately approved revocation design.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, datetime
from threading import RLock

from .sources import (
    Consent,
    PayoutSource,
    Scope,
    Snapshot,
    SourceAccessDenied,
    SourceDataError,
    SourceRecord,
    snapshot_hash,
)


@dataclass(frozen=True)
class StoredSnapshot:
    case_id: str
    run_id: str
    snapshot: Snapshot


class DemoSourceRepository:
    """Store synthetic snapshots and consent history for one process only.

    Cases and runs are registered from server-owned state at construction; a run
    belongs to exactly one registered case. The caller must still authenticate and
    authorize the actor. This class is not a production identity or case store.
    """

    def __init__(
        self,
        shops: set[Scope],
        cases: dict[str, Scope],
        runs: dict[str, str],
        source: PayoutSource,
    ) -> None:
        if any(not case_id.strip() or scope not in shops for case_id, scope in cases.items()):
            raise ValueError("cases must have a nonempty ID and a registered shop")
        if any(not run_id.strip() or case_id not in cases for run_id, case_id in runs.items()):
            raise ValueError("runs must have a nonempty ID and a registered case")
        self._shops = frozenset(shops)
        self._source = source
        self._consents: list[Consent] = []
        self._revocations: dict[tuple[Scope, str], datetime] = {}
        self._cases = dict(cases)
        self._runs = dict(runs)
        self._snapshots: dict[tuple[str, str], StoredSnapshot] = {}
        self._lock = RLock()

    def grant(self, actor_scope: Scope, consent: Consent) -> None:
        with self._lock:
            if actor_scope != consent.scope or consent.scope not in self._shops:
                raise SourceAccessDenied("seller/shop scope invalid")
            if consent.revoked_at is not None:
                raise ValueError("a new grant cannot already be revoked")
            if consent.granted_at > datetime.now(UTC):
                raise ValueError("future-dated consent grants are not supported")
            last_revocation = self._revocations.get((consent.scope, consent.purpose))
            if last_revocation is not None and consent.granted_at <= last_revocation:
                raise ValueError("a new grant must be dated after the last revocation")
            self._consents.append(consent)

    def revoke(self, actor_scope: Scope, scope: Scope, purpose: str) -> None:
        """Revoke all existing grants for a scope/purpose, including future grants."""
        with self._lock:
            if actor_scope != scope or scope not in self._shops:
                raise SourceAccessDenied("seller/shop scope invalid")
            if not purpose.strip():
                raise ValueError("purpose is required")
            now = datetime.now(UTC)
            key = (scope, purpose)
            now = max(now, self._revocations.get(key, now))
            self._revocations[key] = now
            self._consents = [
                replace(c, revoked_at=now)
                if c.scope == scope and c.purpose == purpose and c.revoked_at is None
                else c
                for c in self._consents
            ]

    def capture(
        self, actor_scope: Scope, scope: Scope, purpose: str, case_id: str, run_id: str
    ) -> StoredSnapshot:
        if not case_id.strip() or not run_id.strip() or not purpose.strip():
            raise ValueError("case, run and purpose are required")
        with self._lock:
            now = datetime.now(UTC)
            grants = tuple(c for c in self._consents if c.permits(scope, purpose, now))
            if (
                actor_scope != scope
                or scope not in self._shops
                or self._cases.get(case_id) != scope
                or self._runs.get(run_id) != case_id
                or not grants
            ):
                raise SourceAccessDenied("seller/shop scope or consent invalid")
            if (case_id, run_id) in self._snapshots:
                raise ValueError("snapshot already exists for case/run")
            record = self._source.read(scope)
            if (
                not isinstance(record, SourceRecord)
                or record.scope != scope
                or not record.synthetic
            ):
                raise SourceDataError("source returned invalid, non-synthetic or out-of-scope data")
            captured_at = datetime.now(UTC)
            if not any(
                c in self._consents and c.permits(scope, purpose, captured_at) for c in grants
            ):
                raise SourceAccessDenied("consent expired or was revoked during source read")
            snapshot = Snapshot(
                record, purpose, captured_at, snapshot_hash(record, purpose, captured_at)
            )
            stored = StoredSnapshot(case_id, run_id, snapshot)
            self._snapshots[(case_id, run_id)] = stored
            return stored

    def history(self, actor_scope: Scope, case_id: str) -> tuple[StoredSnapshot, ...]:
        """Read historical snapshots only for the authenticated case scope."""
        with self._lock:
            if self._cases.get(case_id) != actor_scope:
                raise SourceAccessDenied("case scope invalid")
            return tuple(item for (case, _), item in self._snapshots.items() if case == case_id)
