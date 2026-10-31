from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from api.services.foundation.underwriting.demo_sources import demo_payout_source
from api.services.foundation.underwriting.sources import (
    Consent,
    InMemoryAuthorization,
    Payout,
    Scope,
    ScopedPayoutReader,
    SourceAccessDenied,
    SourceDataError,
    SourceRecord,
    SyntheticPayoutSource,
    snapshot_hash,
)

NOW = datetime.now(UTC)
SCOPE = Scope("demo-b", "demo-b")
PURPOSE = "underwriting"
CONSENT = Consent(SCOPE, PURPOSE, NOW - timedelta(days=1), NOW + timedelta(days=1))


class SpySource:
    def __init__(self, record):
        self.record = record
        self.calls = 0

    def read(self, scope):
        self.calls += 1
        return self.record


def record(scope=SCOPE):
    return SourceRecord(scope, (Payout(date(2026, 1, 5), 100),), 200, "fixture", True)


@pytest.mark.parametrize(
    ("shops", "consents", "actor", "requested", "purpose"),
    [
        ({SCOPE}, [], SCOPE, SCOPE, PURPOSE),
        ({SCOPE}, [replace(CONSENT, revoked_at=NOW)], SCOPE, SCOPE, PURPOSE),
        ({SCOPE}, [replace(CONSENT, expires_at=NOW)], SCOPE, SCOPE, PURPOSE),
        ({SCOPE}, [CONSENT], SCOPE, SCOPE, "other-purpose"),
        (set(), [CONSENT], SCOPE, SCOPE, PURPOSE),
        ({SCOPE}, [CONSENT], Scope("another-seller", "demo-b"), SCOPE, PURPOSE),
        ({SCOPE}, [CONSENT], SCOPE, Scope("demo-b", "another-shop"), PURPOSE),
        (
            {SCOPE},
            [replace(CONSENT, scope=Scope("another-seller", "demo-b"))],
            SCOPE,
            SCOPE,
            PURPOSE,
        ),
    ],
)
def test_denied_before_source_read(shops, consents, actor, requested, purpose):
    source = SpySource(record())
    reader = ScopedPayoutReader(InMemoryAuthorization(shops, consents), source)
    with pytest.raises(SourceAccessDenied):
        reader.snapshot(actor, requested, purpose)
    assert source.calls == 0


def test_source_scope_checked_after_read():
    source = SpySource(record(Scope("another-seller", "demo-b")))
    reader = ScopedPayoutReader(InMemoryAuthorization({SCOPE}, [CONSENT]), source)
    with pytest.raises(SourceDataError):
        reader.snapshot(SCOPE, SCOPE, PURPOSE)
    assert source.calls == 1


def test_synthetic_snapshot_has_provenance_and_verifiable_hash():
    reader = ScopedPayoutReader(InMemoryAuthorization({SCOPE}, [CONSENT]), demo_payout_source())
    snapshot = reader.snapshot(SCOPE, SCOPE, PURPOSE)
    assert snapshot.record.synthetic is True
    assert snapshot.record.source_id == "synthetic-demo-b-v1"
    assert [p.amount_vnd for p in snapshot.record.payouts] == [70_000_000] * 4
    assert snapshot.sha256 == snapshot_hash(snapshot.record, snapshot.purpose, snapshot.captured_at)
    altered = replace(snapshot.record, platform_supported_amount_vnd=1)
    assert snapshot.sha256 != snapshot_hash(altered, snapshot.purpose, snapshot.captured_at)


def test_revoking_consent_stops_subsequent_reads():
    auth = InMemoryAuthorization({SCOPE}, [CONSENT])
    source = SpySource(record())
    reader = ScopedPayoutReader(auth, source)
    reader.snapshot(SCOPE, SCOPE, PURPOSE)
    auth.consents[0] = replace(CONSENT, revoked_at=datetime.now(UTC))
    with pytest.raises(SourceAccessDenied):
        reader.snapshot(SCOPE, SCOPE, PURPOSE)
    assert source.calls == 1


def test_demo_source_rejects_unlabelled_and_duplicate_records():
    with pytest.raises(ValueError):
        SyntheticPayoutSource((replace(record(), synthetic=False),))
    with pytest.raises(ValueError):
        SyntheticPayoutSource((record(), record()))


def test_missing_fixture_does_not_return_another_seller():
    with pytest.raises(SourceDataError):
        demo_payout_source().read(Scope("other", "other"))


def test_invalid_payout_and_consent_rejected():
    with pytest.raises(ValueError):
        Payout(date(2026, 1, 5), True)
    with pytest.raises(ValueError):
        Payout(date(2026, 1, 5), -1)
    with pytest.raises(ValueError):
        Consent(SCOPE, PURPOSE, datetime(2026, 1, 1), datetime(2027, 1, 1))


def test_revocation_during_source_read_discards_snapshot():
    auth = InMemoryAuthorization({SCOPE}, [CONSENT])

    class RevokingSource:
        def read(self, scope):
            auth.consents[0] = replace(CONSENT, revoked_at=datetime.now(UTC))
            return record(scope)

    reader = ScopedPayoutReader(auth, RevokingSource())
    with pytest.raises(SourceAccessDenied):
        reader.snapshot(SCOPE, SCOPE, PURPOSE)
