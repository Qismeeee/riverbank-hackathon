"""Unavailable plan extraction route."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.security.auth import Principal
from api.security.dependencies import require_seller
from api.services.foundation.underwriting.availability import workflow_unavailable

router = APIRouter(tags=["copilot"])


@router.post("/v1/copilot/extract-plan", status_code=503)
def extract_plan(principal: Annotated[Principal, Depends(require_seller)]) -> None:
    workflow_unavailable()
