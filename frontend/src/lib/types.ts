export type Role = "seller" | "underwriter";

export type Session = {
  subject: string;
  role: Role;
  full_name?: string | null;
  display_name?: string | null;
  access_token: string;
  token_type: "bearer";
  expires_at: string;
};

export type CaseStatus =
  | "NO_LOAN_NEEDED"
  | "AWAITING_STATEMENT"
  | "PENDING_REVIEW"
  | "ESCALATED"
  | "ACCEPTED"
  | "REJECTED";

export type CaseSummary = {
  case_id: string;
  seller_id: string;
  shop_id: string;
  status: CaseStatus | string;
  version: number;
  reason: string | null;
  created_at: string;
  demo: boolean;
};

export type Payment = { week: number; amount: number };

export type Plan = {
  seller_id: string;
  shop_id: string;
  lot_value: number;
  cash_on_hand: number;
  supplier_schedule: Payment[];
  sell_weeks: number;
  requested_amount: number | null;
  note: string;
};

export type MemoSentence = {
  template: string;
  text: string;
  claims: Record<string, unknown>;
  evidence_id: string;
};

export type SellerDecision = {
  decision_type: string;
  final_amount: number | null;
  final_tenor_weeks: number | null;
};

export type StatementPeriod = {
  start: string;
  end: string;
};

export type StatementFileInfo = {
  media_type: string | null;
  pages: number | null;
  parser: string | null;
  lines: number | null;
  stored: boolean;
};

export type SellerView = CaseSummary & {
  explanation: MemoSentence[];
  decision: SellerDecision | null;
  statement_file?: StatementFileInfo | null;
  statement_period?: StatementPeriod | null;
};

export type QueueResponse = {
  items: CaseSummary[];
  limit: number;
  offset: number;
};

export type WeekRow = {
  week: number;
  bal_start: number;
  payout: number;
  outflow: number;
  bal_end: number;
};

export type Cashflow = {
  payout_base: number;
  payout_stress: number;
  weeks: WeekRow[];
  stress_weeks?: WeekRow[];
  gap: number;
  negative_weeks: number[];
  amount_proposed: number;
  tenor_weeks: number;
  weekly_deduction: number;
  weekly_deductions: number[];
  payout_warning_threshold: number | null;
};

export type PolicyResult = {
  rule_id: string;
  hard: boolean;
  passed: boolean;
  reason: string;
  missing_data?: boolean;
  evidence_id?: string;
};

export type AssessmentRun = {
  run_id: string;
  run_no: number;
  trigger: string;
  cashflow: Cashflow | null;
  risk: {
    pd_bps: number | null;
    model_version?: string;
    source?: string;
    factors?: { name: string; direction: string; contribution: number; value: unknown }[];
    missing_fields?: string[];
    disclosure?: string;
  } | null;
  cic: {
    source: string;
    bureau_group?: string | null;
    outstanding?: number | null;
    queried_at?: string | null;
    gate?: Record<string, unknown>;
  } | null;
  policy: {
    results: PolicyResult[];
    hard_fail: boolean;
    summary: string;
  } | null;
  statement: Record<string, unknown> | null;
  input_snapshot?: {
    features?: {
      weekly_payouts?: { week_start: string }[];
    };
  };
};

export type Evidence = {
  evidence_id: string;
  case_id: string;
  run_id: string;
  code: string;
  schema_version: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  created_at: string;
};

export type CaseEvent = {
  event_id: string;
  actor: string;
  event_type: string;
  previous_status: string | null;
  next_status: string | null;
  reason: string | null;
  occurred_at: string;
  evidence_ids?: string[];
};

export type CaseDetail = CaseSummary & {
  plan: Plan;
  runs: AssessmentRun[];
  evidence: Evidence[];
  documents: {
    document_id: string;
    run_id: string;
    attempt: number;
    underwriter_memo: MemoSentence[];
    seller_explanation: MemoSentence[];
    validated: boolean;
    unfinished: boolean;
    validation_errors: string[];
    generator: string;
    model?: string | null;
    created_at: string;
  }[];
  events: CaseEvent[];
  consent: Record<string, unknown>;
  decision: Record<string, unknown> | null;
  handoff: {
    idempotency_key?: string;
    status?: string;
    attempts?: number;
    last_error?: string | null;
    los_reference?: string | null;
    payload_hash?: string;
  } | null;
};

export type ExtractPlanResponse = {
  draft: {
    seller_id: string;
    shop_id: string;
    lot_value: number | null;
    cash_on_hand: number | null;
    supplier_schedule: Payment[] | null;
    sell_weeks: number | null;
    requested_amount: number | null;
  };
  ready: boolean;
  missing_fields: string[];
  issues: { field: string; code: string }[];
  clarifying_question: string | null;
  sanitized_message: string;
  prompt_version: string;
  model: string;
};

export type StudioPolicy = {
  policy_version: string;
  policy_hash: string;
  engine_version: string;
  policy_config: Record<string, unknown>;
  cashflow_config: Record<string, unknown>;
  rules: { rule_id: string; hard: boolean; order: number }[];
  risk_model: Record<string, unknown>;
  cic_gate: Record<string, unknown>;
};

export type TrafficReport = {
  zone: string;
  generated_at: string;
  targets: { latency_ms: number; cost_micro_usd: number };
  summary: {
    cases: number;
    opened_today: number;
    measured_runs: number;
    unmeasured_runs: number;
    latency_ms: { p50: number | null; p95: number | null };
    cost: {
      known_cases: number;
      unknown_cases: number;
      total_micro_usd: number | null;
      p50_micro_usd: number | null;
    };
  };
  by_day: { day: string; cases: number }[];
  by_status: { status: string; cases: number }[];
  by_model: { model: string; calls: number; cases: number }[];
  recent: {
    case_id: string;
    seller_id: string;
    status: string;
    reason: string | null;
    created_at: string;
    first_run: {
      run_id: string;
      trigger: string;
      started_at: string | null;
      finished_at: string | null;
      duration_ms: number | null;
    } | null;
    models: string[];
    cost_micro_usd: number | null;
    cost_known: boolean;
  }[];
};

export type EvalReport = {
  golden_digest: string;
  summary: { total: number; passed: number; failed: number };
  cases: {
    case_id: string;
    passed: boolean;
    mismatched_keys: string[];
    expected_status: string | null;
    status: string;
    gap: number | null;
    amount_proposed: number | null;
    cic_called: boolean;
    pd_scored: boolean;
  }[];
};

export type DecisionType = "ACCEPT_PROPOSAL" | "ACCEPT_COUNTER" | "REJECT";
