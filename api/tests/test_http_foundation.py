"""Offline HTTP checks for the currently exposed foundation routes."""

import asyncio
import json

import psycopg

from api.main import create_app
from api.security.auth import (
    AuthService,
    AuthUnavailable,
    Grants,
    Identity,
    InvalidAccessToken,
    Role,
    ScopedGrant,
)
from api.services.foundation.underwriting.sources import Scope


def request(app, path, *, authorization=None, origin=None):
    headers = [] if authorization is None else [(b"authorization", authorization.encode())]
    if origin is not None:
        headers.append((b"origin", origin.encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 1234),
        "server": ("test", 80),
        "root_path": "",
    }
    sent = []
    received = False

    async def receive():
        nonlocal received
        if not received:
            received = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    asyncio.run(app(scope, receive, send))
    start = next(message for message in sent if message["type"] == "http.response.start")
    body = b"".join(
        message.get("body", b"") for message in sent if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(body), dict(start["headers"])


class Verifier:
    def verify(self, token):
        if token == "invalid":
            raise InvalidAccessToken
        if token == "unavailable":
            raise AuthUnavailable
        return Identity("https://issuer.example/", "user")


class Resolver:
    def resolve(self, identity):
        return Grants(
            frozenset({Role.SELLER, Role.UNDERWRITER}),
            frozenset({ScopedGrant(Role.SELLER, Scope("seller", "shop"))}),
        )


def test_auth_http_fails_closed_and_returns_server_grants():
    app = create_app(auth_service=AuthService(Verifier(), Resolver()))
    status, _, headers = request(app, "/v1/auth/me")
    assert status == 401
    assert headers[b"www-authenticate"] == b"Bearer"
    assert request(app, "/v1/auth/me", authorization="Bearer invalid")[0] == 401
    assert request(app, "/v1/auth/me", authorization="Bearer unavailable")[0] == 503
    assert request(create_app(), "/v1/auth/me", authorization="Bearer token")[0] == 503

    class UnavailableResolver:
        def resolve(self, identity):
            raise AuthUnavailable

    unavailable_app = create_app(auth_service=AuthService(Verifier(), UnavailableResolver()))
    assert request(unavailable_app, "/v1/auth/me", authorization="Bearer valid")[0] == 503
    status, body, _ = request(app, "/v1/auth/me", authorization="Bearer valid")
    assert status == 200
    assert body == {
        "issuer": "https://issuer.example/",
        "subject": "user",
        "roles": ["seller", "underwriter"],
        "scoped_grants": [{"role": "seller", "seller_id": "seller", "shop_id": "shop"}],
    }


def test_health_http_and_openapi(monkeypatch):
    app = create_app()
    for key in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"):
        monkeypatch.delenv(key, raising=False)
    assert request(app, "/health/db")[:2] == (503, {"detail": "Database not configured"})
    for key in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"):
        monkeypatch.setenv(key, "fixture")

    def unavailable(**kwargs):
        raise psycopg.OperationalError("connection failed")

    monkeypatch.setattr("api.services.health.psycopg.connect", unavailable)
    assert request(app, "/health/db")[:2] == (503, {"detail": "Database unavailable"})

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def execute(self, query):
            assert query == "SELECT 1"

    monkeypatch.setattr("api.services.health.psycopg.connect", lambda **kwargs: Connection())
    assert request(app, "/health/db")[:2] == (200, {"database": "reachable"})
    status, spec, _ = request(app, "/openapi.json")
    assert status == 200
    assert "/health/db" not in spec["paths"]
    operation = spec["paths"]["/v1/auth/me"]["get"]
    assert operation["security"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AuthMeResponse"
    }


def test_cors_allows_only_configured_frontend():
    from api.config import ApiSettings

    app = create_app(ApiSettings(cors_origins=("http://localhost:5173",)))
    _, _, allowed = request(app, "/v1/auth/me", origin="http://localhost:5173")
    _, _, denied = request(app, "/v1/auth/me", origin="http://other.example")
    assert allowed[b"access-control-allow-origin"] == b"http://localhost:5173"
    assert b"access-control-allow-origin" not in denied
