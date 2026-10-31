"""Draft contracts for core integration; these models do not expose routes.

Authorization, consent, input guarding and persistence remain separate gates.
The fixture response is not the finalized case API response.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from api.services.underwriting.models import Plan


class CreateCaseRequest(Plan):
    """The plan in POST /v1/cases; client identifiers never confer ownership."""


class CashFlowWeek(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    week: Annotated[StrictInt, Field(ge=0)]
    opening_vnd: StrictInt
    payout_vnd: Annotated[StrictInt, Field(ge=0)]
    supplier_payment_vnd: Annotated[StrictInt, Field(ge=0)]
    closing_vnd: StrictInt


class LoanProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    amount_vnd: Annotated[StrictInt, Field(gt=0)]
    tenor_weeks: Annotated[StrictInt, Field(gt=0)]
    weekly_schedule_vnd: tuple[Annotated[StrictInt, Field(ge=0)], ...]
    deduction_cap_vnd: Annotated[StrictInt, Field(ge=0)]
    fits_deduction_cap: StrictBool


class SyntheticAssessmentResponse(BaseModel):
    """Internal preview only; never represents an approved credit decision."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    synthetic: Literal[True]
    status: Literal["NO_LOAN_NEEDED", "INCOMPLETE"]
    reasons: tuple[str, ...]
    payout_base_vnd: Annotated[StrictInt, Field(ge=0)]
    payout_stress_vnd: Annotated[StrictInt, Field(ge=0)]
    base: tuple[CashFlowWeek, ...]
    stress: tuple[CashFlowWeek, ...]
    gap_vnd: Annotated[StrictInt, Field(ge=0)]
    warning_payout_vnd: Annotated[StrictInt, Field(ge=0)] | None
    proposal: LoanProposal | None


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    code: Literal[
        "CASE_VERSION_CONFLICT", "IDEMPOTENCY_KEY_REUSED", "HARD_POLICY_FAILURE", "BLOCKED_INPUT"
    ]
    details: object


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    detail: ErrorDetail
