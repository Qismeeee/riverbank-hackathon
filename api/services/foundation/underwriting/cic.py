"""Conditional CIC access contract with a synthetic offline adapter.

The demo purpose and in-memory authorization are not a bank CIC agreement or
proof of valid consent. Production access requires an approved bank contract.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from api.services.foundation.underwriting.sources import AuthorizationStore, Scope


class CICUnavailable(Exception):
    """A CIC query is not authorized, unavailable, or returned invalid data."""


@dataclass(frozen=True)
class CICRecord:
    scope: Scope
    debt_group: int
    outstanding_vnd: int
    source_id: str
    synthetic: bool

    def __post_init__(self) -> None:
        if type(self.debt_group) is not int or not 1 <= self.debt_group <= 5:
            raise ValueError("CIC debt group must be an integer from 1 to 5")
        if type(self.outstanding_vnd) is not int or self.outstanding_vnd < 0:
            raise ValueError("outstanding debt must be non-negative integer VND")
        if not self.source_id.strip() or type(self.synthetic) is not bool:
            raise ValueError("CIC source and synthetic label are required")


class CICSource(Protocol):
    def read(self, scope: Scope) -> CICRecord: ...


class CICGate:
    def __init__(self, authorization: AuthorizationStore, source: CICSource) -> None:
        self._authorization = authorization
        self._source = source

    def inquire(self, actor_scope: Scope, case_scope: Scope, gap_vnd: int) -> CICRecord:
        """Only query for the authenticated case scope with demo CIC consent."""
        if (
            type(gap_vnd) is not int
            or gap_vnd <= 0
            or actor_scope != case_scope
            or not self._authorization.owns_shop(case_scope)
            or not self._authorization.has_consent(case_scope, "cic", datetime.now(UTC))
        ):
            raise CICUnavailable("CIC inquiry is not authorized")
        try:
            record = self._source.read(case_scope)
        except Exception:  # noqa: BLE001 - external adapter failures must fail closed
            raise CICUnavailable("CIC source unavailable") from None
        if not isinstance(record, CICRecord) or record.scope != case_scope:
            raise CICUnavailable("CIC source returned invalid or out-of-scope data")
        return record


class SyntheticCICSource:
    def __init__(self, records: tuple[CICRecord, ...]) -> None:
        self._records: dict[Scope, CICRecord] = {}
        for record in records:
            if not record.synthetic or record.scope in self._records:
                raise ValueError("CIC fixtures must be synthetic and uniquely scoped")
            self._records[record.scope] = record

    def read(self, scope: Scope) -> CICRecord:
        try:
            return self._records[scope]
        except KeyError:
            raise CICUnavailable("no synthetic CIC record for scope") from None
