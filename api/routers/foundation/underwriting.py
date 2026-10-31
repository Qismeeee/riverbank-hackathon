"""Unavailable underwriting routes; no credit decisions or data access occur."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from api.security.auth import Principal
from api.security.dependencies import require_underwriter
from api.services.foundation.underwriting.availability import workflow_unavailable

router = APIRouter(tags=["underwriting"])
Underwriter = Annotated[Principal, Depends(require_underwriter)]


@router.get("/v1/queue", status_code=503)
def queue(principal: Underwriter) -> None:
    workflow_unavailable()


@router.get("/v1/cases/{case_id}", status_code=503)
def case_detail(case_id: UUID, principal: Underwriter) -> None:
    workflow_unavailable()


@router.get("/v1/cases/{case_id}/evidence/{evidence_id}", status_code=503)
def evidence(case_id: UUID, evidence_id: UUID, principal: Underwriter) -> None:
    workflow_unavailable()


@router.post("/v1/cases/{case_id}/cic-inquiry", status_code=503)
def cic_inquiry(case_id: UUID, principal: Underwriter) -> None:
    workflow_unavailable()


@router.post("/v1/cases/{case_id}/decisions", status_code=503)
def decision(case_id: UUID, principal: Underwriter) -> None:
    workflow_unavailable()


@router.post("/v1/cases/{case_id}/handoff", status_code=503)
def handoff(case_id: UUID, principal: Underwriter) -> None:
    workflow_unavailable()
