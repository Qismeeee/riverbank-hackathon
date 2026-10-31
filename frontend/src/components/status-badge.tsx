"use client";

import { statusLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const FALLBACK = {
  chip: "bg-slate-100 text-slate-700 border-slate-300",
  dot: "bg-slate-500",
  rail: "bg-slate-300",
};

const TONE: Record<string, { chip: string; dot: string; rail: string }> = {
  NO_LOAN_NEEDED: {
    chip: "bg-teal-100 text-teal-800 border-teal-300",
    dot: "bg-teal-500",
    rail: "bg-teal-500",
  },
  AWAITING_STATEMENT: {
    chip: "bg-amber-100 text-amber-900 border-amber-300",
    dot: "bg-amber-500",
    rail: "bg-amber-500",
  },
  PENDING_REVIEW: {
    chip: "bg-sky-100 text-sky-800 border-sky-300",
    dot: "bg-sky-500",
    rail: "bg-sky-500",
  },
  ESCALATED: {
    chip: "bg-violet-100 text-violet-800 border-violet-300",
    dot: "bg-violet-500",
    rail: "bg-violet-500",
  },
  ACCEPTED: {
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-500",
    rail: "bg-emerald-500",
  },
  REJECTED: {
    chip: "bg-rose-100 text-rose-800 border-rose-300",
    dot: "bg-rose-500",
    rail: "bg-rose-500",
  },
};

export function statusChrome(status: string) {
  return TONE[status] ?? FALLBACK;
}

export function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  const { m } = useI18n();
  const tone = statusChrome(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone.chip}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {statusLabel(status, reason, m.status, m.reason)}
    </span>
  );
}
