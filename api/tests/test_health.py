def test_health_http_without_services_or_credentials():
    from fastapi.testclient import TestClient

    from api.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_cors_allows_only_configured_frontend():
    from fastapi.testclient import TestClient

    from api.config import Settings
    from api.main import create_app

    with TestClient(
        create_app(Settings(allowed_origins=["http://localhost:3000"]))
    ) as client:
        allowed = client.get("/health", headers={"Origin": "http://localhost:3000"})
        blocked = client.get("/health", headers={"Origin": "https://other.example"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in blocked.headers
