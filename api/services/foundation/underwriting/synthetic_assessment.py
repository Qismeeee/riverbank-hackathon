"""Offline calculation over caller-supplied synthetic data, not a case workflow.

No source is read and no consent, provenance, policy approval or credit decision
is inferred from a fixture label. Never connect this service directly to an API.
"""

from dataclasses import dataclass
from typing import Literal

from api.services.foundation.cashflow import CashFlowConfig, CashFlowResult, calculate_cashflow
from api.services.foundation.underwriting.models import Plan, PlanInputCaps, check_plan_caps
from api.services.foundation.underwriting.sources import SourceRecord


@dataclass(frozen=True)
class SyntheticAssessment:
    status: Literal["NO_LOAN_NEEDED", "INCOMPLETE"]
    cashflow: CashFlowResult
    reasons: tuple[str, ...]
    synthetic: Literal[True] = True


def assess_synthetic(
    plan: Plan, record: SourceRecord, caps: PlanInputCaps, config: CashFlowConfig
) -> SyntheticAssessment:
    """Calculate a fixture only; caller supplies fixture limits and parameters.

    The label is a restriction on inputs, not proof of consent or provenance.
    In particular, a positive gap cannot proceed to PD, CIC or policy here.
    """
    if not isinstance(plan, Plan) or not isinstance(record, SourceRecord):
        raise TypeError("validated plan and synthetic source record required")
    if record.synthetic is not True:
        raise ValueError("only synthetic records are supported")
    if (record.scope.seller_id, record.scope.shop_id) != (plan.seller_id, plan.shop_id):
        raise ValueError("plan and fixture scope mismatch")
    check_plan_caps(plan, caps)
    result = calculate_cashflow(
        plan.to_cashflow_plan(), tuple(p.amount_vnd for p in record.payouts), config
    )
    if result.gap_vnd == 0:
        return SyntheticAssessment("NO_LOAN_NEEDED", result, ())
    return SyntheticAssessment(
        "INCOMPLETE", result, ("CONSENT_UNVERIFIED", "PD_CIC_POLICY_UNAVAILABLE")
    )
