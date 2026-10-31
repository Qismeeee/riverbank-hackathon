"""PD inference contract; no model is installed or enabled by default."""

from dataclasses import dataclass
from typing import Protocol

from api.services.foundation.features import RiskFeatures


@dataclass(frozen=True)
class PDResult:
    pd_bps: int
    model_version: str
    synthetic: bool

    def __post_init__(self) -> None:
        if type(self.pd_bps) is not int or not 0 <= self.pd_bps <= 10_000:
            raise ValueError("PD must be an integer between 0 and 10000 basis points")
        if not self.model_version.strip() or type(self.synthetic) is not bool:
            raise ValueError("model provenance and synthetic label are required")


class PDModel(Protocol):
    def predict(self, features: RiskFeatures) -> PDResult: ...


class RiskUnavailable(Exception):
    """The model is unavailable or failed; callers must not assume a safe PD."""


def predict_pd(features: RiskFeatures, model: PDModel | None) -> PDResult:
    if model is None:
        raise RiskUnavailable("PD model is not configured")
    try:
        result = model.predict(features)
    except Exception:  # noqa: BLE001 - model failures must fail closed
        raise RiskUnavailable("PD model failed") from None
    if not isinstance(result, PDResult):
        raise RiskUnavailable("PD model returned invalid output")
    return result
