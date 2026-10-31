/** Phép chiếu dòng tiền trên landing, đơn vị triệu đồng. Không phải CashFlowEngine. */

export type ProjectionInput = {
  lot: number;
  cash: number;
  dep: number;
  rem: number;
  weeks: number;
  payout: number;
};

export type ProjectionResult = {
  gap: number;
  base: number[];
  withLoan: number[] | null;
  amount: number;
  term: number;
  weekly: number;
  total: number;
  negWeeks: number;
  threshold: number;
};

const STRESS = 0.7;
const RATE_WEEK = 0.0083;
const DEDUCT_CAP = 0.25;

function simulate(plan: ProjectionInput, payout: number): number[] {
  const out: number[] = [];
  let balance = plan.cash;
  for (let week = 0; week <= plan.weeks; week += 1) {
    let pay = 0;
    if (week === 0) pay += plan.lot * plan.dep;
    if (plan.dep < 1 && week === Math.min(plan.rem, plan.weeks)) pay += plan.lot * (1 - plan.dep);
    balance += (week >= 1 ? payout : 0) - pay;
    out.push(Math.round(balance * 10) / 10);
  }
  return out;
}

function thresholdPayout(plan: ProjectionInput): number {
  for (let payout = 0; payout <= 300; payout += 1) {
    if (Math.min(...simulate(plan, payout)) >= 0) return payout;
  }
  return 300;
}

export function projectCashflow(plan: ProjectionInput): ProjectionResult {
  const base = simulate(plan, plan.payout);
  const gap = Math.max(0, -Math.min(...base));
  if (!gap) {
    return { gap: 0, base, withLoan: null, amount: 0, term: 0, weekly: 0, total: 0, negWeeks: 0, threshold: thresholdPayout(plan) };
  }
  const negWeeks = base.filter((value) => value < 0).length;
  let amount = Math.ceil((gap * 1.1) / 5) * 5;
  if (amount > gap * 1.15) amount = Math.floor(gap * 1.15);
  const ceiling = DEDUCT_CAP * plan.payout * STRESS;
  let term = negWeeks + 2;
  let total = 0;
  let weekly = 0;
  while (true) {
    total = Math.round(amount * (1 + RATE_WEEK * term));
    weekly = Math.ceil(total / term);
    if (weekly <= ceiling || term >= 26) break;
    term += 2;
  }
  const withLoan = base.map((value, index) => Math.round((value + amount - weekly * Math.min(index, term)) * 10) / 10);
  return { gap, base, withLoan, amount, term, weekly, total, negWeeks, threshold: 0 };
}

export function trieu(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("vi-VN")} triệu`;
}
