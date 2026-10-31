"""Small, explicit feature contract shared by offline and serving code.

Only payout history and calculated cash-flow values are accepted. This is not a
trained model or a representation of observed repayment performance.
"""

from dataclasses import dataclass

from api.services.foundation.cashflow import CashFlowResult
from api.services.foundation.underwriting.sources import Snapshot, snapshot_hash


@dataclass(frozen=True)
class RiskFeatures:
    payout_base_vnd: int
    payout_stress_vnd: int
    gap_vnd: int
    proposed_amount_vnd: int
    proposed_tenor_weeks: int
    payout_history_weeks: int


def build_risk_features(snapshot: Snapshot, cashflow: CashFlowResult) -> RiskFeatures:
    """Build an allowlisted feature vector for a positive-gap assessment."""
    if snapshot.sha256 != snapshot_hash(snapshot.record, snapshot.purpose, snapshot.captured_at):
        raise ValueError("snapshot hash mismatch")
    proposal = cashflow.proposal
    if cashflow.gap_vnd <= 0 or proposal is None:
        raise ValueError("risk features require a positive gap and proposal")
    return RiskFeatures(
        payout_base_vnd=cashflow.payout_base_vnd,
        payout_stress_vnd=cashflow.payout_stress_vnd,
        gap_vnd=cashflow.gap_vnd,
        proposed_amount_vnd=proposal.amount_vnd,
        proposed_tenor_weeks=proposal.tenor_weeks,
        payout_history_weeks=len(snapshot.record.payouts),
    )
