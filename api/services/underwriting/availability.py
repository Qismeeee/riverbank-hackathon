"""Fail-closed boundary for workflows awaiting their dependencies."""

from typing import NoReturn

from fastapi import HTTPException, status


def workflow_unavailable() -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "WORKFLOW_UNAVAILABLE", "details": "Workflow is not available"},
    )
