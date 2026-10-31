import type { MemoSentence, Plan, Session } from "./types";

const MONEY_KEYS = new Set([
  "gap",
  "amount_proposed",
  "weekly_deduction",
  "payout_warning_threshold",
  "final_amount",
  "lot_value",
  "cash_on_hand",
  "requested_amount",
  "outstanding",
]);

export function personName(session: Pick<Session, "subject" | "full_name" | "display_name">): string {
  return session.full_name?.trim() || session.display_name?.trim() || session.subject;
}

export function displayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function payoutPeriod(run: {
  input_snapshot?: { features?: { weekly_payouts?: { week_start?: string }[] } };
} | null | undefined): { start: string; end: string } | null {
  const weeks = run?.input_snapshot?.features?.weekly_payouts ?? [];
  const starts = weeks.map((row) => row.week_start).filter((day): day is string => Boolean(day)).sort();
  if (!starts.length) return null;
  const end = new Date(`${starts[starts.length - 1]}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: starts[0], end: end.toISOString().slice(0, 10) };
}

export function vnd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

export function formatClaim(key: string, value: unknown): string {
  if (typeof value === "number" && MONEY_KEYS.has(key)) return vnd(value);
  if (typeof value === "number" && key.includes("week")) return `${value} tuần`;
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "—";
  return String(value);
}

export function claimsOf(sentences: MemoSentence[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sentence of sentences) {
    for (const [key, value] of Object.entries(sentence.claims ?? {})) out[key] = value;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXED_RE = /^([A-Za-z][A-Za-z0-9]{0,7}-)(.+)$/;

export function caseCode(id: string): string {
  if (UUID_RE.test(id)) return `HS-${id.slice(0, 8).toUpperCase()}`;
  const prefixed = PREFIXED_RE.exec(id);
  if (prefixed) {
    const prefix = prefixed[1].toUpperCase();
    const rest = prefixed[2];
    if (rest.length <= 12) return `${prefix}${rest}`;
    return `${prefix}${rest.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }
  return id;
}

const CLOCK_LOCALE = { vi: "vi-VN", en: "en-GB", zh: "zh-CN" } as const;

export function age(iso: string, ago: { minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string }): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return ago.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return ago.hours(hours);
  return ago.days(Math.round(hours / 24));
}

export function clock(iso: string, locale: keyof typeof CLOCK_LOCALE = "vi"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(CLOCK_LOCALE[locale], {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function newestFirst<T extends { created_at: string; case_id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (delta !== 0 && !Number.isNaN(delta)) return delta;
    return (b.case_id ?? "").localeCompare(a.case_id ?? "");
  });
}

function lookup(map: object, key: string): string | undefined {
  return (map as Record<string, string>)[key];
}

export function statusLabel(status: string, reason: string | null | undefined, statusMap: object, reasonMap: object): string {
  const base = lookup(statusMap, status) ?? status;
  if (!reason) return base;
  return `${base} · ${lookup(reasonMap, reason) ?? reason}`;
}

function detailLine(item: unknown): string | null {
  if (typeof item === "string" && item.trim()) return item.trim();
  if (!item || typeof item !== "object") return null;
  if ("message" in item && typeof item.message === "string" && item.message.trim()) return item.message.trim();
  if ("msg" in item && typeof item.msg === "string" && item.msg.trim()) return item.msg.trim();
  return null;
}

export function errorText(err: unknown, friendly: object, fallback: string): string {
  if (err instanceof Error && "code" in err) {
    const code = String((err as { code?: string }).code ?? "");
    const details = (err as { details?: unknown[] }).details ?? [];
    const lines = details.map(detailLine).filter((line): line is string => Boolean(line));
    if (code === "BLOCKED_INPUT" && lines.length) return lines.join(" ");
    const base = lookup(friendly, code) ?? err.message;
    if (lines.length) return `${base} (${lines.join(", ")})`;
    return base;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function planFromTrieu(input: {
  sellerId: string;
  lotTr: number;
  cashTr: number;
  depositPct: number;
  remWeek: number;
  sellWeeks: number;
  requestedTr: number | null;
  note: string;
}): Plan {
  const lot = Math.round(input.lotTr * 1_000_000);
  const cash = Math.round(input.cashTr * 1_000_000);
  const requested = input.requestedTr == null ? null : Math.round(input.requestedTr * 1_000_000);
  const pct = Math.min(100, Math.max(0, input.depositPct));
  const sellWeeks = Math.min(26, Math.max(1, Math.round(input.sellWeeks)));
  const rem = Math.min(sellWeeks, Math.max(1, Math.round(input.remWeek)));
  let schedule: Plan["supplier_schedule"];
  if (pct >= 100) schedule = [{ week: 0, amount: lot }];
  else if (pct <= 0) schedule = [{ week: rem, amount: lot }];
  else {
    const first = Math.round((lot * pct) / 100);
    const rest = lot - first;
    schedule =
      rest <= 0 || rem === 0
        ? [{ week: 0, amount: lot }]
        : [
            { week: 0, amount: first },
            { week: rem, amount: rest },
          ];
  }
  return {
    seller_id: input.sellerId,
    shop_id: input.sellerId,
    lot_value: lot,
    cash_on_hand: cash,
    supplier_schedule: schedule,
    sell_weeks: sellWeeks,
    requested_amount: requested,
    note: input.note.trim(),
  };
}

export function idempotencyKey(fingerprint: string): string {
  const storageKey = "riverbank-idempotency";
  const raw = sessionStorage.getItem(storageKey);
  const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  if (!map[fingerprint]) map[fingerprint] = crypto.randomUUID();
  sessionStorage.setItem(storageKey, JSON.stringify(map));
  return map[fingerprint];
}

export function parseVnd(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}
