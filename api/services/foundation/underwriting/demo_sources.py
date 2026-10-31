"""Explicitly simulated fixtures for local development, never real payout data."""

from datetime import date

from .sources import Payout, Scope, SourceRecord, SyntheticPayoutSource


def demo_payout_source() -> SyntheticPayoutSource:
    return SyntheticPayoutSource(
        (
            SourceRecord(
                scope=Scope("demo-b", "demo-b"),
                payouts=tuple(Payout(date(2026, 1, day), 70_000_000) for day in (5, 12, 19, 26)),
                platform_supported_amount_vnd=100_000_000,
                source_id="synthetic-demo-b-v1",
                synthetic=True,
            ),
        )
    )
