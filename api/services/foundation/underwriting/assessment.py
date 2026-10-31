"""Preliminary, non-decision assessment over an already authorized snapshot.

This is not the case workflow: CIC, policy, evidence persistence and decisions
are deliberately unavailable until their contracts and approval are in place.
"""

from dataclasses import dataclass

from api.services.foundation.cashflow import (
    CashFlowConfig,
    CashFlowPlan,
    CashFlowResult,
    calculate_cashflow,
)
from api.services.foundation.features import build_risk_features
from api.services.foundation.risk import PDModel, PDResult, RiskUnavailable, predict_pd
from api.services.foundation.underwriting.sources import Scope, Snapshot, snapshot_hash


@dataclass(frozen=True)
class PreliminaryAssessment:
    status: str
    cashflow: CashFlowResult
    pd: PDResult | None
    reasons: tuple[str, ...]


def assess_snapshot(
    scope: Scope,
    plan: CashFlowPlan,
    snapshot: Snapshot,
    config: CashFlowConfig,
    model: PDModel | None = None,
) -> PreliminaryAssessment:
    """Calculate only from a scoped snapshot previously obtained through the reader.

    Caller is responsible for authentication and obtaining fresh consent through
    ScopedPayoutReader. Hash verifies consistency, not identity or authorization.
    """
    if snapshot.record.scope != scope or snapshot.purpose != "underwriting":
        raise ValueError("snapshot scope or purpose mismatch")
    if snapshot.sha256 != snapshot_hash(snapshot.record, snapshot.purpose, snapshot.captured_at):
        raise ValueError("snapshot hash mismatch")
    result = calculate_cashflow(plan, tuple(p.amount_vnd for p in snapshot.record.payouts), config)
    if result.gap_vnd == 0:
        return PreliminaryAssessment("NO_LOAN_NEEDED", result, None, ())
    try:
        features = build_risk_features(snapshot, result)
        pd = predict_pd(features, model)
    except RiskUnavailable:
        return PreliminaryAssessment(
            "INCOMPLETE", result, None, ("PD_UNAVAILABLE", "CIC_AND_POLICY_UNAVAILABLE")
        )
    return PreliminaryAssessment("INCOMPLETE", result, pd, ("CIC_AND_POLICY_UNAVAILABLE",))
