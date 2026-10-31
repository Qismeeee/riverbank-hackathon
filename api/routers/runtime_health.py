"""Liveness and explicit infrastructure readiness endpoints."""

from fastapi import APIRouter, Request, Response

from api.readiness import check_dependencies

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(request: Request, response: Response) -> dict:
    checks = check_dependencies(request.app.state.runtime_settings)
    available = all(value == "ok" for value in checks.values())
    response.status_code = 200 if available else 503
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok" if available else "unavailable", "checks": checks}
