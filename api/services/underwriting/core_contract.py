"""Explicit mapping of implemented domain errors and fixture responses."""

from dataclasses import asdict

from api.schemas.core import SyntheticAssessmentResponse
from api.services.underwriting.repository import IdempotencyKeyReused
from api.services.underwriting.synthetic_assessment import SyntheticAssessment


def synthetic_response(result: SyntheticAssessment) -> SyntheticAssessmentResponse:
    return SyntheticAssessmentResponse.model_validate(
        {
            "synthetic": result.synthetic,
            "status": result.status,
            "reasons": result.reasons,
            **asdict(result.cashflow),
        }
    )


def domain_error_code(error: Exception) -> str | None:
    """Map only errors with an existing domain type; unknown errors stay unmapped."""
    if isinstance(error, IdempotencyKeyReused):
        return "IDEMPOTENCY_KEY_REUSED"
    return None
