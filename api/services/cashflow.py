"""Deterministic cash-flow calculations; callers must supply authorized parameters.

This module does not load or approve policy and does not make credit decisions.
All monetary inputs and outputs are integer VND.
"""

from dataclasses import dataclass
from fractions import Fraction


@dataclass(frozen=True)
class CashFlowConfig:
    stress_factor: Fraction
    buffer_factor: Fraction
    buffer_cap: Fraction
    amount_rounding_vnd: int
    tenor_buffer_weeks: int
    tenor_extend_step_weeks: int
    max_tenor_weeks: int
    deduction_cap_ratio: Fraction
    payout_start_week: int
    extra_weeks: int
    min_history_weeks: int
    max_history_weeks: int = 104

    def __post_init__(self) -> None:
        ratios = (self.stress_factor, self.buffer_factor, self.buffer_cap, self.deduction_cap_ratio)
        if any(not isinstance(x, Fraction) or x < 0 for x in ratios):
            raise ValueError("ratios must be non-negative exact fractions")
        if self.buffer_factor < 1 or self.buffer_cap < 1:
            raise ValueError("proposal buffers must be at least 1")
        if self.stress_factor > 1 or self.deduction_cap_ratio > 1:
            raise ValueError("stress and deduction ratios cannot exceed 1")
        ints = (
            self.amount_rounding_vnd,
            self.tenor_extend_step_weeks,
            self.max_tenor_weeks,
            self.min_history_weeks,
            self.max_history_weeks,
        )
        if any(type(x) is not int or x <= 0 for x in ints):
            raise ValueError("positive integer configuration required")
        if any(type(x) is not int or x < 0 for x in (self.tenor_buffer_weeks, self.extra_weeks)):
            raise ValueError("buffer and extra weeks must be non-negative integers")
        if self.payout_start_week < 1 or type(self.payout_start_week) is not int:
            raise ValueError("payout must start after week zero")
        if self.min_history_weeks > self.max_history_weeks:
            raise ValueError("invalid history range")


@dataclass(frozen=True)
class SupplierPayment:
    week: int
    amount_vnd: int

    def __post_init__(self) -> None:
        if type(self.week) is not int or self.week < 0:
            raise ValueError("supplier week must be a non-negative integer")
        if type(self.amount_vnd) is not int or self.amount_vnd < 0:
            raise ValueError("supplier amount must be non-negative integer VND")


@dataclass(frozen=True)
class CashFlowPlan:
    lot_value_vnd: int
    cash_on_hand_vnd: int
    sell_weeks: int
    supplier_schedule: tuple[SupplierPayment, ...]

    def __post_init__(self) -> None:
        if type(self.lot_value_vnd) is not int or self.lot_value_vnd <= 0:
            raise ValueError("lot value must be positive integer VND")
        if type(self.cash_on_hand_vnd) is not int or self.cash_on_hand_vnd < 0:
            raise ValueError("cash on hand must be non-negative integer VND")
        if type(self.sell_weeks) is not int or self.sell_weeks < 1:
            raise ValueError("sell_weeks must be a positive integer")
        if not isinstance(self.supplier_schedule, tuple) or not self.supplier_schedule:
            raise ValueError("supplier schedule is required")
        if not all(isinstance(p, SupplierPayment) for p in self.supplier_schedule):
            raise ValueError("invalid supplier schedule")
        if sum(p.amount_vnd for p in self.supplier_schedule) != self.lot_value_vnd:
            raise ValueError("supplier payments must equal lot value")
        if any(p.week > self.sell_weeks for p in self.supplier_schedule):
            raise ValueError("supplier payment exceeds selling period")


@dataclass(frozen=True)
class Week:
    week: int
    opening_vnd: int
    payout_vnd: int
    supplier_payment_vnd: int
    closing_vnd: int


@dataclass(frozen=True)
class Proposal:
    amount_vnd: int
    tenor_weeks: int
    weekly_schedule_vnd: tuple[int, ...]
    deduction_cap_vnd: int
    fits_deduction_cap: bool


@dataclass(frozen=True)
class CashFlowResult:
    payout_base_vnd: int
    payout_stress_vnd: int
    base: tuple[Week, ...]
    stress: tuple[Week, ...]
    gap_vnd: int
    warning_payout_vnd: int | None
    proposal: Proposal | None


def _ceil(value: Fraction) -> int:
    return -(-value.numerator // value.denominator)


def _median_vnd(values: tuple[int, ...]) -> int:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) // 2


def _table(plan: CashFlowPlan, payout: int, config: CashFlowConfig) -> tuple[Week, ...]:
    payments: dict[int, int] = {}
    for payment in plan.supplier_schedule:
        payments[payment.week] = payments.get(payment.week, 0) + payment.amount_vnd
    end = max(plan.sell_weeks, max(payments) + 1) + config.extra_weeks
    balance = plan.cash_on_hand_vnd
    rows = []
    for week in range(end + 1):
        received = payout if config.payout_start_week <= week <= plan.sell_weeks else 0
        expense = payments.get(week, 0)
        closing = balance + received - expense
        rows.append(Week(week, balance, received, expense, closing))
        balance = closing
    return tuple(rows)


def _warning_threshold(plan: CashFlowPlan, config: CashFlowConfig) -> int | None:
    cumulative = 0
    threshold = 0
    for week in range(plan.sell_weeks + 1):
        cumulative += sum(p.amount_vnd for p in plan.supplier_schedule if p.week == week)
        deficit = max(0, cumulative - plan.cash_on_hand_vnd)
        count = max(0, week - config.payout_start_week + 1)
        if count == 0 and deficit:
            return None
        if count:
            threshold = max(threshold, _ceil(Fraction(deficit, count)))
    return threshold


def calculate_cashflow(
    plan: CashFlowPlan, payout_history_vnd: tuple[int, ...], config: CashFlowConfig
) -> CashFlowResult:
    if not config.min_history_weeks <= len(payout_history_vnd) <= config.max_history_weeks:
        raise ValueError("insufficient or excessive payout history")
    if any(type(p) is not int or p < 0 for p in payout_history_vnd):
        raise ValueError("payout history must contain non-negative integer VND amounts")
    base_payout = _median_vnd(payout_history_vnd)
    stress_payout = int(base_payout * config.stress_factor)
    base = _table(plan, base_payout, config)
    stress = _table(plan, stress_payout, config)
    gap = max(0, -min(row.closing_vnd for row in base))
    if gap == 0:
        return CashFlowResult(
            base_payout, stress_payout, base, stress, 0, _warning_threshold(plan, config), None
        )
    rounded = _ceil(Fraction(gap) * config.buffer_factor / config.amount_rounding_vnd)
    amount = min(rounded * config.amount_rounding_vnd, int(gap * config.buffer_cap))
    if amount <= 0:
        raise ValueError("configuration produced a non-positive loan proposal")
    negative = [row.week for row in base if row.closing_vnd < 0]
    tenor = min(negative[-1] - negative[0] + 1 + config.tenor_buffer_weeks, config.max_tenor_weeks)
    cap = int(stress_payout * config.deduction_cap_ratio)
    while _ceil(Fraction(amount, tenor)) > cap and tenor < config.max_tenor_weeks:
        tenor = min(tenor + config.tenor_extend_step_weeks, config.max_tenor_weeks)
    quotient, remainder = divmod(amount, tenor)
    schedule = tuple(quotient + (week < remainder) for week in range(tenor))
    proposal = Proposal(amount, tenor, schedule, cap, max(schedule) <= cap)
    return CashFlowResult(base_payout, stress_payout, base, stress, gap, None, proposal)
