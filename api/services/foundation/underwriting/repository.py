"""Process-local case journal for offline development, not an authorization boundary.

Callers must authenticate and authorize scope before every operation. This store is
not durable, distributed, or suitable for real personal or financial information.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from uuid import UUID, uuid4

from api.services.foundation.underwriting.models import Plan
from api.services.foundation.underwriting.sources import Scope, SourceAccessDenied


class CaseNotFound(LookupError):
    pass


class IdempotencyKeyReused(ValueError):
    pass


@dataclass(frozen=True)
class Case:
    case_id: UUID
    scope: Scope
    plan: Plan
    version: int
    created_at: datetime


@dataclass(frozen=True)
class CaseEvent:
    event_id: UUID
    case_id: UUID
    version: int
    actor_id: str
    event_type: str
    occurred_at: datetime


class MemoryCaseRepository:
    """Atomic within one process only. No underwriting or decisions are performed."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._cases: dict[UUID, Case] = {}
        self._events: dict[UUID, tuple[CaseEvent, ...]] = {}
        self._creates: dict[tuple[str, str], tuple[Plan, Case]] = {}

    def create(self, scope: Scope, actor_id: str, key: str, plan: Plan) -> Case:
        if not actor_id.strip() or not key.strip() or len(key) > 255:
            raise ValueError("actor and idempotency key required")
        if scope != Scope(plan.seller_id, plan.shop_id):
            raise SourceAccessDenied("case scope invalid")
        with self._lock:
            # A seller cannot reuse a key for a different shop or payload.
            scoped_key = (scope.seller_id, key)
            previous = self._creates.get(scoped_key)
            if previous is not None:
                if previous[0] != plan:
                    raise IdempotencyKeyReused("idempotency key reused with different input")
                return previous[1]
            now = datetime.now(UTC)
            case = Case(uuid4(), scope, plan, 1, now)
            event = CaseEvent(uuid4(), case.case_id, 1, actor_id, "CASE_CREATED", now)
            self._cases[case.case_id] = case
            self._events[case.case_id] = (event,)
            self._creates[scoped_key] = (plan, case)
            return case

    def get(self, scope: Scope, case_id: UUID) -> Case:
        with self._lock:
            case = self._cases.get(case_id)
            if case is None or case.scope != scope:
                raise CaseNotFound("case not found")
            return case

    def list_for_scope(self, scope: Scope) -> tuple[Case, ...]:
        with self._lock:
            return tuple(case for case in self._cases.values() if case.scope == scope)

    def events(self, scope: Scope, case_id: UUID) -> tuple[CaseEvent, ...]:
        with self._lock:
            self.get(scope, case_id)
            return self._events[case_id]
