"""Published case routes, unavailable until the business workflow is ready."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header

from api.schemas.core import CreateCaseRequest
from api.security.auth import Principal
from api.security.dependencies import current_principal, require_seller, require_seller_ownership
from api.services.underwriting.availability import workflow_unavailable
from api.services.underwriting.sources import Scope

router = APIRouter(tags=["cases"])


@router.post("/v1/cases", status_code=503)
def create_case(
    plan: CreateCaseRequest,
    principal: Annotated[Principal, Depends(current_principal)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=255)],
) -> None:
    """Create and assess a case once the workflow gates are implemented."""
    require_seller_ownership(principal, Scope(plan.seller_id, plan.shop_id))
    workflow_unavailable()


@router.get("/v1/me/cases", status_code=503)
def list_cases(principal: Annotated[Principal, Depends(require_seller)]) -> None:
    workflow_unavailable()


@router.get("/v1/cases/{case_id}/seller-view", status_code=503)
def seller_view(case_id: UUID, principal: Annotated[Principal, Depends(require_seller)]) -> None:
    # A real implementation must load the case and check its server-resolved scope.
    workflow_unavailable()
