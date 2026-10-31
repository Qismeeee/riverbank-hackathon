"""Auth0 custom-API access tokens for one explicitly configured SPA client."""

from urllib.parse import urlsplit

import jwt

from api.security.auth import AuthUnavailable, Identity, InvalidAccessToken


class Auth0AccessTokenVerifier:
    """Verify RS256 access tokens; never use an issuer or key URL from a token."""

    def __init__(self, issuer: str, audience: str, client_id: str) -> None:
        parsed = urlsplit(issuer)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or not parsed.hostname.endswith(".auth0.com")
            or parsed.username is not None
            or parsed.password is not None
            or parsed.netloc != parsed.hostname
            or parsed.path != "/"
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("issuer must be an HTTPS Auth0 tenant URL ending in /")
        if (
            not audience.strip()
            or not client_id.strip()
            or audience != audience.strip()
            or client_id != client_id.strip()
            or audience == client_id
        ):
            raise ValueError("distinct API audience and client ID are required")
        self._issuer = issuer
        self._audience = audience
        self._client_id = client_id
        self._keys = jwt.PyJWKClient(
            issuer + ".well-known/jwks.json", timeout=3, lifespan=300, cache_keys=False
        )

    def verify(self, access_token: str) -> Identity:
        if not isinstance(access_token, str) or len(access_token) > 16384:
            raise InvalidAccessToken("invalid access token")
        try:
            header = jwt.get_unverified_header(access_token)
            if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
                raise InvalidAccessToken("invalid access token")
            key = self._keys.get_signing_key_from_jwt(access_token)
            claims = jwt.decode(
                access_token,
                key.key,
                algorithms=["RS256"],
                issuer=self._issuer,
                audience=self._audience,
                options={"require": ["iss", "sub", "aud", "exp", "iat", "azp"]},
            )
            subject = claims["sub"]
            audiences = claims["aud"]
            if (
                claims["azp"] != self._client_id
                or (audiences == self._client_id)
                or (isinstance(audiences, list) and self._client_id in audiences)
                or not isinstance(subject, str)
                or not subject.strip()
                or len(subject) > 255
                or not subject.isascii()
                or subject.endswith("@clients")
            ):
                raise InvalidAccessToken("invalid access token")
            return Identity(self._issuer, subject)
        except (jwt.exceptions.InvalidTokenError, TypeError, ValueError):
            raise InvalidAccessToken("invalid access token") from None
        except (jwt.exceptions.PyJWKClientError, jwt.exceptions.PyJWKError):
            raise AuthUnavailable("signing keys unavailable") from None
