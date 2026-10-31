"""Immutable, hash-checked evidence envelope; hash is not source authentication."""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4


def _check_json(value: object) -> None:
    # Reject floats (including NaN), arbitrary objects and non-string keys so
    # canonical serialization and numeric comparisons are unambiguous.
    if value is None or type(value) in (bool, int, str):
        return
    if isinstance(value, list):
        for item in value:
            _check_json(item)
        return
    if isinstance(value, dict) and all(type(key) is str for key in value):
        for item in value.values():
            _check_json(item)
        return
    raise ValueError("evidence must contain JSON values without floating point numbers")


def _digest(
    evidence_id: UUID, case_id: UUID, run_id: UUID, code: str, captured_at: datetime, payload: bytes
) -> str:
    header = json.dumps(
        {
            "evidence_id": str(evidence_id),
            "case_id": str(case_id),
            "run_id": str(run_id),
            "code": code,
            "captured_at": captured_at.astimezone(UTC).isoformat(),
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(header + b"\n" + payload).hexdigest()


@dataclass(frozen=True)
class Evidence:
    evidence_id: UUID
    case_id: UUID
    run_id: UUID
    code: str
    captured_at: datetime
    payload_json: bytes
    sha256: str

    @classmethod
    def create(cls, case_id: UUID, run_id: UUID, code: str, payload: dict) -> "Evidence":
        if code not in {"E4", "E5", "E6", "E6a", "E7", "E8"}:
            raise ValueError("unsupported evidence code")
        if not isinstance(payload, dict):
            raise TypeError("evidence payload must be an object")
        _check_json(payload)
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        encoded_bytes = encoded.encode("utf-8")
        evidence_id = uuid4()
        now = datetime.now(UTC)
        digest = _digest(evidence_id, case_id, run_id, code, now, encoded_bytes)
        return cls(evidence_id, case_id, run_id, code, now, encoded_bytes, digest)

    def verified_payload(self, case_id: UUID, run_id: UUID) -> dict:
        if self.case_id != case_id or self.run_id != run_id:
            raise ValueError("evidence case or run mismatch")
        if self.captured_at.tzinfo is None or self.captured_at.utcoffset() is None:
            raise ValueError("evidence timestamp lacks timezone")
        if self.code not in {"E4", "E5", "E6", "E6a", "E7", "E8"}:
            raise ValueError("unsupported evidence code")
        if self.sha256 != _digest(
            self.evidence_id,
            self.case_id,
            self.run_id,
            self.code,
            self.captured_at,
            self.payload_json,
        ):
            raise ValueError("evidence hash mismatch")
        payload = json.loads(self.payload_json)
        if not isinstance(payload, dict):
            raise TypeError("evidence payload must be an object")
        _check_json(payload)
        return payload
