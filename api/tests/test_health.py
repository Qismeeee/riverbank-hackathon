def test_health_http_without_services_or_credentials():
    from fastapi.testclient import TestClient

    from api.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_cors_allows_default_frontends_and_blocks_other_origins():
    from fastapi.testclient import TestClient

    from api.main import create_app

    frontend_origin = "https://ezxriverbank-hackathon.vercel.app"
    with TestClient(create_app()) as client:
        allowed = client.get("/health", headers={"Origin": "http://localhost:3000"})
        frontend = client.get("/health", headers={"Origin": frontend_origin})
        preflight = client.options(
            "/health",
            headers={
                "Origin": frontend_origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
        )
        blocked = client.get("/health", headers={"Origin": "https://other.example"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert frontend.headers["access-control-allow-origin"] == frontend_origin
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == frontend_origin
    assert preflight.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in blocked.headers
