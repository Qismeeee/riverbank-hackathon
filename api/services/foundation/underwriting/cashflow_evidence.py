"""Serialize a calculated cash-flow result as E5 evidence.

This helper does not obtain a snapshot, authorize a request, calculate the
result, persist evidence, or establish that the result came from a given source.
The workflow must establish those relationships before using the evidence.
"""

from dataclasses import asdict
from uuid import UUID

from api.services.foundation.cashflow import CashFlowResult
from api.services.foundation.underwriting.evidence import Evidence


def make_cashflow_evidence(case_id: UUID, run_id: UUID, result: CashFlowResult) -> Evidence:
    """Capture the engine output without recalculating or altering its numbers."""
    if not isinstance(result, CashFlowResult):
        raise TypeError("cashflow result required")
    proposal = result.proposal
    return Evidence.create(
        case_id,
        run_id,
        "E5",
        {
            "payout_base_vnd": result.payout_base_vnd,
            "payout_stress_vnd": result.payout_stress_vnd,
            "base": [asdict(row) for row in result.base],
            "stress": [asdict(row) for row in result.stress],
            "gap_vnd": result.gap_vnd,
            "warning_payout_vnd": result.warning_payout_vnd,
            "proposal": None
            if proposal is None
            else {
                "amount_vnd": proposal.amount_vnd,
                "tenor_weeks": proposal.tenor_weeks,
                "weekly_schedule_vnd": list(proposal.weekly_schedule_vnd),
                "deduction_cap_vnd": proposal.deduction_cap_vnd,
                "fits_deduction_cap": proposal.fits_deduction_cap,
            },
        },
    )
