"""Plan input contract; no policy is loaded and no source is accessed here."""

from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    field_validator,
    model_validator,
)

from api.services.cashflow import CashFlowPlan, SupplierPayment

NonNegativeVND = Annotated[StrictInt, Field(ge=0)]
PositiveVND = Annotated[StrictInt, Field(gt=0)]


class SupplierScheduleEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    week: Annotated[StrictInt, Field(ge=0)]
    amount: NonNegativeVND


class Plan(BaseModel):
    """Untrusted plan input, before authorization, consent and input guarding."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    seller_id: StrictStr
    shop_id: StrictStr
    lot_value: PositiveVND
    cash_on_hand: NonNegativeVND
    supplier_schedule: Annotated[tuple[SupplierScheduleEntry, ...], Field(min_length=1)]
    sell_weeks: Annotated[StrictInt, Field(gt=0)]
    requested_amount: NonNegativeVND
    note: StrictStr = ""

    @field_validator("seller_id", "shop_id")
    @classmethod
    def nonblank_identifier(cls, value: str) -> str:
        if not value.strip() or value != value.strip():
            raise ValueError("identifier must be nonblank and have no surrounding whitespace")
        return value

    @model_validator(mode="after")
    def schedule_matches_plan(self) -> "Plan":
        if sum(row.amount for row in self.supplier_schedule) != self.lot_value:
            raise ValueError("supplier payments must equal lot value")
        if any(row.week > self.sell_weeks for row in self.supplier_schedule):
            raise ValueError("supplier payment exceeds selling period")
        return self

    def to_cashflow_plan(self) -> CashFlowPlan:
        return CashFlowPlan(
            lot_value_vnd=self.lot_value,
            cash_on_hand_vnd=self.cash_on_hand,
            sell_weeks=self.sell_weeks,
            supplier_schedule=tuple(
                SupplierPayment(week=row.week, amount_vnd=row.amount)
                for row in self.supplier_schedule
            ),
        )


class PlanInputCaps(BaseModel):
    """Explicit input limits supplied by the caller; never loaded from demo policy here."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    max_requested_amount_vnd: PositiveVND
    max_sell_weeks: Annotated[StrictInt, Field(gt=0)]
    max_supplier_week: Annotated[StrictInt, Field(ge=0)]
    max_supplier_rows: Annotated[StrictInt, Field(gt=0)]
    max_note_chars: Annotated[StrictInt, Field(ge=0)]


def check_plan_caps(plan: Plan, caps: PlanInputCaps) -> None:
    """Reject inputs beyond supplied caps; caller must obtain authorized configuration.

    This check is not input guarding, identity/scope validation or marketplace consent.
    """
    if plan.requested_amount > caps.max_requested_amount_vnd:
        raise ValueError("requested amount exceeds input cap")
    if plan.sell_weeks > caps.max_sell_weeks:
        raise ValueError("selling period exceeds input cap")
    if len(plan.supplier_schedule) > caps.max_supplier_rows:
        raise ValueError("supplier schedule exceeds input cap")
    if any(row.week > caps.max_supplier_week for row in plan.supplier_schedule):
        raise ValueError("supplier week exceeds input cap")
    if len(plan.note) > caps.max_note_chars:
        raise ValueError("note exceeds input cap")
