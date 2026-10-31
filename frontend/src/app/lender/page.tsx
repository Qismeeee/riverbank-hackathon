"use client";

import { useEffect, useMemo, useState } from "react";
import { CaseRow } from "@/components/case-row";
import { Shell } from "@/components/shell";
import { toast } from "@/components/toast";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { errorText, newestFirst, statusLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { CaseSummary } from "@/lib/types";

const FILTERS = ["ALL", "PENDING_REVIEW", "ESCALATED", "AWAITING_STATEMENT", "NO_LOAN_NEEDED", "DECIDED"] as const;

type FilterId = (typeof FILTERS)[number];

export default function LenderPage() {
  const { session, ready } = useRequireRole("underwriter");
  const { m } = useI18n();
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [decided, setDecided] = useState<CaseSummary[]>([]);
  const [filter, setFilter] = useState<FilterId>("PENDING_REVIEW");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    api
      .queue(session.access_token)
      .then((data) => setItems(data.items))
      .catch((err: unknown) => {
        const text = errorText(err, m.errors, m.common.server);
        setError(text);
        toast(text, "err");
      });
    Promise.all([api.queue(session.access_token, "ACCEPTED"), api.queue(session.access_token, "REJECTED")])
      .then(([accepted, rejected]) => setDecided(newestFirst([...accepted.items, ...rejected.items])))
      .catch((err: unknown) => {
        const text = errorText(err, m.errors, m.common.server);
        setError(text);
        toast(text, "err");
      });
  }, [session, m]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) map[item.status] = (map[item.status] ?? 0) + 1;
    return map;
  }, [items]);

  const ordered = useMemo(() => newestFirst(items), [items]);
  const visible = filter === "DECIDED" ? decided : filter === "ALL" ? ordered : ordered.filter((item) => item.status === filter);

  if (!ready || !session) {
    return (
      <Shell active="lender">
        <main className="p-10 text-sm text-slate-500">{m.common.checking}</main>
      </Shell>
    );
  }

  return (
    <Shell active="lender">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{m.lender.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{m.lender.lead}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="text-slate-500">{m.lender.open}</div>
            <div className="tnum text-lg font-semibold text-slate-900">{items.length}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((id) => {
            const count = id === "ALL" ? items.length : id === "DECIDED" ? decided.length : counts[id] ?? 0;
            const label =
              id === "ALL" ? m.lender.all : id === "DECIDED" ? m.lender.decided : id === "AWAITING_STATEMENT" ? m.lender.statement : statusLabel(id, null, m.status, m.reason);
            return (
              <button
                key={id}
                type="button"
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${filter === id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/60"}`}
                onClick={() => setFilter(id)}
              >
                {label} {count}
              </button>
            );
          })}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        <ul className="mt-4 space-y-2">
          {visible.map((item) => (
            <li key={item.case_id}>
              <CaseRow item={item} tone="teal" href={`/lender/${item.case_id}`} />
            </li>
          ))}
        </ul>
        {visible.length === 0 ? <p className="mt-6 text-sm text-slate-600">{m.lender.empty}</p> : null}
      </main>
    </Shell>
  );
}
