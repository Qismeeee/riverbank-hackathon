"""Unavailable policy and evaluation routes."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.security.auth import Principal
from api.security.dependencies import require_underwriter
from api.services.foundation.underwriting.availability import workflow_unavailable

router = APIRouter(tags=["studio"])
Underwriter = Annotated[Principal, Depends(require_underwriter)]


@router.get("/v1/studio/policy", status_code=503)
def policy(principal: Underwriter) -> None:
    workflow_unavailable()


@router.get("/v1/studio/eval-metrics", status_code=503)
def eval_metrics(principal: Underwriter) -> None:
    workflow_unavailable()
