from dataclasses import replace
from datetime import UTC, datetime

import pytest

from api.services.foundation.features import build_risk_features
from api.services.foundation.risk import PDResult, RiskUnavailable, predict_pd
from api.services.foundation.underwriting.assessment import assess_snapshot
from api.services.foundation.underwriting.demo_sources import demo_payout_source
from api.services.foundation.underwriting.sources import Scope, Snapshot, snapshot_hash
from api.tests.test_cashflow import plan

pytest_plugins = ("api.tests.test_cashflow",)

SCOPE = Scope("demo-b", "demo-b")


@pytest.fixture
def snapshot():
    record = demo_payout_source().read(SCOPE)
    now = datetime.now(UTC)
    return Snapshot(record, "underwriting", now, snapshot_hash(record, "underwriting", now))


class Model:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def predict(self, features):
        self.calls.append(features)
        return self.result


@pytest.mark.parametrize(
    ("payments", "cash", "gap", "amount"),
    [
        ([(0, 100_000_000), (4, 100_000_000)], 120_000_000, 0, None),
        ([(0, 200_000_000)], 120_000_000, 80_000_000, 90_000_000),
        ([(0, 200_000_000)], 50_000_000, 150_000_000, 165_000_000),
    ],
)
def test_preliminary_golden_and_zero_gap_gate(config, snapshot, payments, cash, gap, amount):
    model = Model(PDResult(250, "synthetic-v1", True))
    result = assess_snapshot(SCOPE, plan(payments, cash), snapshot, config, model)
    assert result.cashflow.gap_vnd == gap
    if gap == 0:
        assert result.status == "NO_LOAN_NEEDED"
        assert result.pd is None and not model.calls
    else:
        assert result.status == "INCOMPLETE"
        assert result.cashflow.proposal.amount_vnd == amount
        assert result.pd == model.result
        assert len(model.calls) == 1
        assert model.calls[0].gap_vnd == gap
        assert model.calls[0].payout_history_weeks == 4
        assert "CIC_AND_POLICY_UNAVAILABLE" in result.reasons


def test_feature_and_assessment_reject_tampered_snapshot(config, snapshot):
    result = assess_snapshot(SCOPE, plan([(0, 200_000_000)]), snapshot, config)
    altered = replace(snapshot, sha256="0" * 64)
    with pytest.raises(ValueError, match="hash"):
        build_risk_features(altered, result.cashflow)
    with pytest.raises(ValueError, match="hash"):
        assess_snapshot(SCOPE, plan([(0, 200_000_000)]), altered, config)
    with pytest.raises(ValueError, match="scope"):
        assess_snapshot(Scope("other", "other"), plan([(0, 200_000_000)]), snapshot, config)


def test_missing_or_bad_model_fails_closed(config, snapshot):
    result = assess_snapshot(SCOPE, plan([(0, 200_000_000)]), snapshot, config)
    assert result.status == "INCOMPLETE"
    assert "PD_UNAVAILABLE" in result.reasons
    features = build_risk_features(snapshot, result.cashflow)
    with pytest.raises(RiskUnavailable):
        predict_pd(features, Model(None))

    class Broken:
        def predict(self, features):
            raise RuntimeError("private error")

    with pytest.raises(RiskUnavailable, match="model failed"):
        predict_pd(features, Broken())


@pytest.mark.parametrize("value", [-1, 10001, True, 1.5])
def test_pd_invalid_values_rejected(value):
    with pytest.raises(ValueError):
        PDResult(value, "v1", True)
