from fractions import Fraction
from pathlib import Path

import pytest
import yaml

from api.services.foundation.cashflow import (
    CashFlowConfig,
    CashFlowPlan,
    SupplierPayment,
    calculate_cashflow,
)


@pytest.fixture
def config():
    # The demo policy is read only for offline fixture tests, not approved for runtime use.
    data = yaml.safe_load(Path("policy/parameters.yaml").read_text())["cashflow"]
    return CashFlowConfig(
        stress_factor=Fraction(str(data["stress_factor"])),
        buffer_factor=Fraction(str(data["buffer_factor"])),
        buffer_cap=Fraction(str(data["buffer_cap"])),
        amount_rounding_vnd=data["amount_rounding_vnd"],
        tenor_buffer_weeks=data["tenor_buffer_weeks"],
        tenor_extend_step_weeks=data["tenor_extend_step_weeks"],
        max_tenor_weeks=data["max_tenor_weeks"],
        deduction_cap_ratio=Fraction(str(data["deduction_cap_ratio"])),
        payout_start_week=data["payout_start_week"],
        extra_weeks=data["extra_weeks"],
        min_history_weeks=data["min_history_weeks"],
    )


def plan(payments, cash=120_000_000):
    return CashFlowPlan(200_000_000, cash, 6, tuple(SupplierPayment(*p) for p in payments))


def test_worked_example_a(config):
    result = calculate_cashflow(
        plan([(0, 100_000_000), (4, 100_000_000)]), (70_000_000,) * 12, config
    )
    assert [row.closing_vnd for row in result.base[:5]] == [
        20_000_000,
        90_000_000,
        160_000_000,
        230_000_000,
        200_000_000,
    ]
    assert result.gap_vnd == 0
    assert result.warning_payout_vnd == 20_000_000
    assert result.proposal is None


def test_worked_example_b(config):
    result = calculate_cashflow(plan([(0, 200_000_000)]), (70_000_000,) * 12, config)
    assert [row.closing_vnd for row in result.base[:3]] == [-80_000_000, -10_000_000, 60_000_000]
    assert result.gap_vnd == 80_000_000
    assert result.payout_stress_vnd == 49_000_000
    assert result.proposal.amount_vnd == 90_000_000
    assert result.proposal.tenor_weeks == 8
    assert result.proposal.weekly_schedule_vnd == (11_250_000,) * 8
    assert result.proposal.deduction_cap_vnd == 12_250_000
    assert result.proposal.fits_deduction_cap


def test_worked_example_e(config):
    result = calculate_cashflow(
        plan([(0, 200_000_000)], cash=50_000_000), (70_000_000,) * 12, config
    )
    assert (result.gap_vnd, result.proposal.amount_vnd, result.proposal.tenor_weeks) == (
        150_000_000,
        165_000_000,
        15,
    )


def test_schedule_conserves_vnd_and_flags_unmet_cap(config):
    small_plan = CashFlowPlan(103, 0, 1, (SupplierPayment(0, 103),))
    result = calculate_cashflow(small_plan, (0,) * 4, config)
    proposal = result.proposal
    assert not proposal.fits_deduction_cap
    assert proposal.tenor_weeks == config.max_tenor_weeks
    assert sum(proposal.weekly_schedule_vnd) == proposal.amount_vnd
    assert max(proposal.weekly_schedule_vnd) - min(proposal.weekly_schedule_vnd) <= 1
    assert list(proposal.weekly_schedule_vnd) == sorted(proposal.weekly_schedule_vnd, reverse=True)


def test_median_uses_all_history_and_floors_half_vnd(config):
    result = calculate_cashflow(plan([(0, 200_000_000)]), (1, 2, 3, 100), config)
    assert result.payout_base_vnd == 2


def test_missing_and_invalid_history_fail_clearly(config):
    for history in [(1, 2, 3), (1, 2, 3, -1), (1, 2, 3, True), (1,) * 105]:
        with pytest.raises(ValueError):
            calculate_cashflow(plan([(0, 200_000_000)]), history, config)


def test_invalid_plan_rejected():
    with pytest.raises(ValueError):
        plan([(0, 100_000_000)])
    with pytest.raises(ValueError):
        plan([(7, 200_000_000)])
