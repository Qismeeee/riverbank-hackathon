from functools import cache
from typing import Annotated

from fastapi import Depends

from api import config
from api.routers.auth import Actor, get_actor
from api.services.ratelimit import RateLimit, RateLimiter
from api.services.underwriting.service import utc_now


@cache
def limiter(scope: str) -> RateLimiter:
    return RateLimiter(RateLimit.parse(config.rate_limit(scope)))


def rate_limited(scope: str):
    def check(actor: Annotated[Actor, Depends(get_actor)]) -> None:
        limiter(scope).hit(f"{actor.role}:{actor.subject}", utc_now())

    return Depends(check)
