"""Operational health routes."""

from fastapi import APIRouter, HTTPException

from api.services.health import DatabaseNotConfigured, DatabaseUnavailable, check_database

router = APIRouter()


@router.get("/health/db", include_in_schema=False)
def database_health() -> dict[str, str]:
    try:
        check_database()
    except DatabaseNotConfigured:
        raise HTTPException(status_code=503, detail="Database not configured") from None
    except DatabaseUnavailable:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"database": "reachable"}
