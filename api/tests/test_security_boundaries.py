from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from api.security.auth import Grants, Identity, InvalidAccessToken, Principal, Role, ScopedGrant
from api.security.auth0 import Auth0AccessTokenVerifier
from api.security.dependencies import require_seller_ownership, require_underwriter
from api.services.underwriting.cic import CICGate, CICRecord, CICUnavailable
from api.services.underwriting.sources import Consent, InMemoryAuthorization, Scope

SCOPE = Scope("seller", "shop")
OTHER = Scope("seller", "other")


def test_seller_and_platform_underwriter_permissions_are_distinct():
    identity = Identity("issuer", "subject")
    seller = Principal(
        identity, Grants(frozenset({Role.SELLER}), frozenset({ScopedGrant(Role.SELLER, SCOPE)}))
    )
    banker = Principal(identity, Grants(frozenset({Role.UNDERWRITER}), frozenset()))
    require_seller_ownership(seller, SCOPE)
    with pytest.raises(HTTPException) as denied:
        require_seller_ownership(seller, OTHER)
    assert denied.value.status_code == 403
    with pytest.raises(HTTPException):
        require_underwriter(seller)
    assert require_underwriter(banker) is banker
    assert banker.permits(Role.UNDERWRITER, OTHER)
    assert not banker.owns_seller_shop(SCOPE)


def test_cic_requires_positive_gap_correct_scope_and_separate_consent():
    now = datetime.now(UTC)
    consent = Consent(SCOPE, "cic", now - timedelta(days=1), now + timedelta(days=1))
    auth = InMemoryAuthorization({SCOPE}, [replace(consent, purpose="underwriting")])

    class Source:
        calls = 0

        def read(self, scope):
            self.calls += 1
            return CICRecord(scope, 1, 0, "fixture", True)

    source = Source()
    gate = CICGate(auth, source)
    for actor, gap in [(SCOPE, 0), (OTHER, 1), (SCOPE, 1)]:
        with pytest.raises(CICUnavailable):
            gate.inquire(actor, SCOPE, gap)
    assert source.calls == 0
    auth.consents.append(consent)
    assert gate.inquire(SCOPE, SCOPE, 1).scope == SCOPE
    assert source.calls == 1


@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.mark.parametrize(
    "mutation", ["issuer", "audience", "expired", "id_token", "azp", "signature"]
)
def test_auth0_rejects_invalid_signed_tokens(signing_key, mutation):
    verifier = Auth0AccessTokenVerifier("https://test.auth0.com/", "api", "client")
    verifier._keys = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=signing_key.public_key())
    )
    now = datetime.now(UTC)
    claims = {
        "iss": "https://test.auth0.com/",
        "sub": "user",
        "aud": "api",
        "azp": "client",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    if mutation == "issuer":
        claims["iss"] = "https://other.auth0.com/"
    if mutation == "audience":
        claims["aud"] = "other"
    if mutation == "expired":
        claims["exp"] = now - timedelta(seconds=1)
    if mutation == "id_token":
        claims["aud"] = "client"
    if mutation == "azp":
        claims["azp"] = "other"
    key = (
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
        if mutation == "signature"
        else signing_key
    )
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})
    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)


def test_auth0_accepts_valid_signed_access_token(signing_key):
    verifier = Auth0AccessTokenVerifier("https://test.auth0.com/", "api", "client")
    verifier._keys = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=signing_key.public_key())
    )
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "iss": "https://test.auth0.com/",
            "sub": "user",
            "aud": "api",
            "azp": "client",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        signing_key,
        algorithm="RS256",
        headers={"kid": "test"},
    )
    assert verifier.verify(token) == Identity("https://test.auth0.com/", "user")
