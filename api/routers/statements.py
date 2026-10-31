"""Statement route placeholders; no document is read or persisted."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from api.security.auth import Principal
from api.security.dependencies import require_seller_or_underwriter, require_underwriter
from api.services.foundation.underwriting.availability import workflow_unavailable

router = APIRouter(tags=["statements"])


@router.post("/v1/cases/{case_id}/statements", status_code=503)
def statement(case_id: UUID, principal: Annotated[Principal, Depends(require_underwriter)]) -> None:
    workflow_unavailable()


@router.post("/v1/cases/{case_id}/statements/upload", status_code=503)
def upload_statement(
    case_id: UUID, principal: Annotated[Principal, Depends(require_seller_or_underwriter)]
) -> None:
    # Seller access must additionally verify the persisted case ownership before processing.
    workflow_unavailable()
