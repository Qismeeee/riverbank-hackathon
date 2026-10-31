from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from api.services.underwriting.demo_repository import DemoSourceRepository
from api.services.underwriting.demo_sources import demo_payout_source
from api.services.underwriting.evidence import Evidence
from api.services.underwriting.models import Plan
from api.services.underwriting.repository import (
    CaseNotFound,
    IdempotencyKeyReused,
    MemoryCaseRepository,
)
from api.services.underwriting.sources import Consent, Scope, SourceAccessDenied

SCOPE = Scope("demo-b", "demo-b")


def make_plan():
    return Plan(
        seller_id="demo-b",
        shop_id="demo-b",
        lot_value=100,
        cash_on_hand=0,
        supplier_schedule=({"week": 0, "amount": 100},),
        sell_weeks=1,
        requested_amount=100,
    )


def test_concurrent_idempotent_create_keeps_one_case_and_event():
    repo = MemoryCaseRepository()
    with ThreadPoolExecutor(max_workers=8) as pool:
        cases = list(pool.map(lambda _: repo.create(SCOPE, "actor", "key", make_plan()), range(20)))
    assert len({case.case_id for case in cases}) == 1
    assert len(repo.events(SCOPE, cases[0].case_id)) == 1
    with pytest.raises(IdempotencyKeyReused):
        repo.create(SCOPE, "actor", "key", make_plan().model_copy(update={"requested_amount": 99}))
    with pytest.raises(CaseNotFound):
        repo.get(Scope("other", "shop"), cases[0].case_id)


def test_evidence_rejects_tamper_and_cross_case_or_run():
    case_id, run_id = uuid4(), uuid4()
    evidence = Evidence.create(case_id, run_id, "E4", {"amount": 123})
    assert evidence.verified_payload(case_id, run_id) == {"amount": 123}
    for case, run in [(uuid4(), run_id), (case_id, uuid4())]:
        with pytest.raises(ValueError, match="case or run"):
            evidence.verified_payload(case, run)
    with pytest.raises(ValueError, match="hash"):
        replace(evidence, payload_json=b'{"amount":124}').verified_payload(case_id, run_id)
    with pytest.raises(ValueError):
        Evidence.create(case_id, run_id, "E4", {"amount": 1.5})


def test_revoke_without_prior_grant_rejects_backdated_consent():
    repo = DemoSourceRepository({SCOPE}, {"case": SCOPE}, {"run": "case"}, demo_payout_source())
    before = datetime.now(UTC) - timedelta(seconds=1)
    repo.revoke(SCOPE, SCOPE, "underwriting")
    with pytest.raises(ValueError, match="revocation"):
        repo.grant(SCOPE, Consent(SCOPE, "underwriting", before, before + timedelta(days=1)))
    with pytest.raises(SourceAccessDenied):
        repo.capture(SCOPE, SCOPE, "underwriting", "case", "run")


def test_revocation_blocks_new_capture_but_preserves_demo_history():
    repo = DemoSourceRepository(
        {SCOPE}, {"case": SCOPE}, {"run": "case", "run2": "case"}, demo_payout_source()
    )
    now = datetime.now(UTC)
    repo.grant(
        SCOPE, Consent(SCOPE, "underwriting", now - timedelta(days=1), now + timedelta(days=1))
    )
    saved = repo.capture(SCOPE, SCOPE, "underwriting", "case", "run")
    repo.revoke(SCOPE, SCOPE, "underwriting")
    with pytest.raises(SourceAccessDenied):
        repo.capture(SCOPE, SCOPE, "underwriting", "case", "run2")
    assert repo.history(SCOPE, "case") == (saved,)
    with pytest.raises(SourceAccessDenied):
        repo.history(Scope("other", "other"), "case")
