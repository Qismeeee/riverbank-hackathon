import type {
  CaseDetail,
  CaseSummary,
  DecisionType,
  EvalReport,
  TrafficReport,
  Evidence,
  ExtractPlanResponse,
  Plan,
  QueueResponse,
  SellerView,
  Session,
  StudioPolicy,
} from "./types";

type JobView = {
  job_id: string;
  kind: string;
  case_id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | string;
  result?: { case_id?: string; status?: string; version?: number } | null;
  error?: { code?: string; status?: number; details?: unknown[] } | null;
  created_at: string;
  updated_at: string;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://13-214-87-165.sslip.io";

export class ApiError extends Error {
  status: number;
  code?: string;
  details: unknown[];

  constructor(status: number, data: unknown) {
    const detail = data && typeof data === "object" && "detail" in data ? data.detail : undefined;
    let code: string | undefined;
    let details: unknown[] = [];
    let message = `HTTP ${status}`;
    if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) {
      code = String(detail.code);
      const extra = "details" in detail ? detail.details : undefined;
      details = Array.isArray(extra) ? extra : [];
      message = code;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const loc = "loc" in item && Array.isArray(item.loc) ? item.loc.filter((part: unknown) => part !== "body").join(".") : "";
            return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
          }
          return "Dữ liệu không đúng kiểu";
        })
        .join("; ");
    } else if (typeof detail === "string") message = detail;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAuthError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 401 || err.code === "INVALID_TOKEN" || err.code === "TOKEN_EXPIRED" || err.code === "AUTHENTICATION_REQUIRED";
}

async function call<T>(token: string | null, method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { detail: { code: "NETWORK", details: [] } });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

async function uploadCall<T>(token: string, path: string, form: FormData): Promise<T> {
  return uploadCallStatus<T>(token, path, form, [200, 201, 202]);
}

async function uploadCallStatus<T>(token: string, path: string, form: FormData, ok: number[]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError(0, { detail: { code: "NETWORK", details: [] } });
  }
  const data = await response.json().catch(() => ({}));
  if (!ok.includes(response.status)) throw new ApiError(response.status, data);
  return data as T;
}

async function downloadCall(token: string, path: string): Promise<{ blob: Blob; name: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, { detail: { code: "NETWORK", details: [] } });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data);
  }
  const header = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(header);
  return { blob: await response.blob(), name: match?.[1] ?? "" };
}

export const api = {
  login: (subject: string, role: Session["role"], passcode: string) =>
    call<Session>(null, "POST", "/v1/auth/token", { subject, role, passcode }),
  myCases: (token: string) => call<QueueResponse>(token, "GET", "/v1/me/cases?limit=50&offset=0"),
  extractPlan: (token: string, sellerId: string, message: string) =>
    call<ExtractPlanResponse>(token, "POST", "/v1/copilot/extract-plan", {
      seller_id: sellerId,
      shop_id: sellerId,
      message,
    }),
  createCase: (token: string, plan: Plan, key: string) =>
    call<CaseSummary>(token, "POST", "/v1/cases", plan, { "Idempotency-Key": key }),
  sellerView: (token: string, caseId: string) => call<SellerView>(token, "GET", `/v1/cases/${caseId}/seller-view`),
  download: (token: string, path: string) => downloadCall(token, path),
  queue: (token: string, status?: string, offset = 0) => {
    const query = new URLSearchParams({ limit: "100", offset: String(offset) });
    if (status) query.set("status", status);
    return call<QueueResponse>(token, "GET", `/v1/queue?${query}`);
  },
  getJob: (token: string, jobId: string) => call<JobView>(token, "GET", `/v1/jobs/${jobId}`),
  uploadStatement: (
    token: string,
    caseId: string,
    input: { expected_version: number; period_start: string; period_end: string; file: File },
  ): Promise<CaseSummary> => {
    const form = new FormData();
    form.set("expected_version", String(input.expected_version));
    form.set("period_start", input.period_start);
    form.set("period_end", input.period_end);
    form.set("file", input.file);
    return (async () => {
      const job = await uploadCallStatus<JobView>(
        token,
        `/v1/cases/${caseId}/statements/upload-jobs`,
        form,
        [202],
      );
      let current = job;
      while (current.status === "QUEUED" || current.status === "RUNNING") {
        await new Promise((r) => setTimeout(r, 1000));
        current = await api.getJob(token, current.job_id);
      }
      if (current.status === "FAILED") {
        const err = current.error;
        throw new ApiError(err?.status ?? 500, {
          detail: { code: err?.code ?? "JOB_FAILED", details: err?.details ?? [] },
        });
      }
      const result = current.result;
      if (!result?.case_id || result.version == null) {
        throw new ApiError(500, { detail: { code: "JOB_RESULT_MISSING", details: [] } });
      }
      return {
        case_id: result.case_id,
        seller_id: "",
        shop_id: "",
        status: result.status ?? "",
        version: result.version,
        reason: null,
        created_at: current.created_at,
      };
    })();
  },
  caseDetail: (token: string, caseId: string) => call<CaseDetail>(token, "GET", `/v1/cases/${caseId}`),
  evidence: (token: string, caseId: string, evidenceId: string) =>
    call<Evidence>(token, "GET", `/v1/cases/${caseId}/evidence/${evidenceId}`),
  statement: (
    token: string,
    caseId: string,
    body: { expected_version: number; period_start: string; period_end: string; marketplace_total: number; document_ref: string },
  ) => call<CaseSummary>(token, "POST", `/v1/cases/${caseId}/statements`, body),
  cicInquiry: (token: string, caseId: string, body: { expected_version: number; reason: string }) =>
    call<CaseSummary>(token, "POST", `/v1/cases/${caseId}/cic-inquiry`, body),
  decision: (
    token: string,
    caseId: string,
    key: string,
    body: {
      expected_version: number;
      decision_type: DecisionType;
      final_amount?: number;
      final_tenor_weeks?: number;
      verification_note: string;
      reason: string;
    },
  ) => call<CaseSummary & { decision: Record<string, unknown> }>(token, "POST", `/v1/cases/${caseId}/decisions`, body, { "Idempotency-Key": key }),
  handoff: (token: string, caseId: string, expectedVersion: number) =>
    call<CaseSummary & { handoff: CaseDetail["handoff"] }>(token, "POST", `/v1/cases/${caseId}/handoff`, {
      expected_version: expectedVersion,
    }),
  policy: (token: string) => call<StudioPolicy>(token, "GET", "/v1/studio/policy"),
  evalMetrics: (token: string) => call<EvalReport>(token, "GET", "/v1/studio/eval-metrics"),
  traffic: (token: string) => call<TrafficReport>(token, "GET", "/v1/studio/traffic"),
};
