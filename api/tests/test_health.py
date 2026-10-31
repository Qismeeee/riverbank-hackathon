def test_health_http_without_services_or_credentials():
    from fastapi.testclient import TestClient

    from api.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}
