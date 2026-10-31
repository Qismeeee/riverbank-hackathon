"use client";

import { CaseRow } from "@/components/case-row";
import { Pagination } from "@/components/pagination";
import { Shell } from "@/components/shell";
import { useRequireRole } from "@/lib/auth";
import { errorText, statusLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useCaseList } from "@/lib/use-case-list";

const FILTERS = ["ALL", "PENDING_REVIEW", "ESCALATED", "AWAITING_STATEMENT", "NO_LOAN_NEEDED", "DECIDED"] as const;

export default function LenderPage() {
  const { session, ready } = useRequireRole("underwriter");
  const { m } = useI18n();
  const list = useCaseList(session?.access_token, "queue", "PENDING_REVIEW");
  const filter = list.filter ?? "ALL";
  const error = list.error ? errorText(list.error, m.errors, m.common.server) : "";
  const counts = list.counts;
  const openCount = counts
    ? (counts.PENDING_REVIEW ?? 0) + (counts.ESCALATED ?? 0) + (counts.AWAITING_STATEMENT ?? 0) + (counts.NO_LOAN_NEEDED ?? 0)
    : filter === "ALL" ? list.total : undefined;

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
          <div className="flex items-center gap-3">
            <button type="button" disabled={list.loading} onClick={() => list.refresh(true)} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40">{m.pagination.refresh}</button>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <div className="text-slate-500">{m.lender.open}</div>
              <div className="tnum text-lg font-semibold text-slate-900">{openCount ?? "—"}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((id) => {
            const count = id === "ALL" ? openCount : id === "DECIDED"
              ? counts ? (counts.ACCEPTED ?? 0) + (counts.REJECTED ?? 0) : filter === id ? list.total : undefined
              : counts?.[id] ?? (filter === id ? list.total : undefined);
            const label =
              id === "ALL" ? m.lender.all : id === "DECIDED" ? m.lender.decided : id === "AWAITING_STATEMENT" ? m.lender.statement : statusLabel(id, null, m.status, m.reason);
            return (
              <button
                key={id}
                type="button"
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${filter === id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/60"}`}
                aria-pressed={filter === id}
                onClick={() => list.setFilter(id === "ALL" ? undefined : id)}
              >
                {label}{count == null ? "" : ` ${count}`}
              </button>
            );
          })}
        </div>
        {error ? <div className="mt-4 flex items-center gap-3 text-sm text-rose-600" role="alert"><p>{error}</p><button type="button" className="cursor-pointer underline" onClick={() => list.refresh()}>{m.pagination.retry}</button></div> : null}
        {list.loading ? <p className="mt-4 text-sm text-slate-600" role="status">{m.common.loading}</p> : null}
        <ul className="mt-4 space-y-2" aria-busy={list.loading}>
          {list.items.map((item) => (
            <li key={item.case_id}>
              <CaseRow item={item} tone="teal" href={`/lender/${item.case_id}`} />
            </li>
          ))}
        </ul>
        {!list.loading && !error && list.items.length === 0 ? <p className="mt-6 text-sm text-slate-600">{m.lender.empty}</p> : null}
        <Pagination offset={list.offset} pageSize={list.pageSize} count={list.items.length} total={list.total} hasMore={list.hasMore} loading={list.loading} disabled={Boolean(error)} onOffsetChange={list.setOffset} onPageSizeChange={list.setPageSize} />
      </main>
    </Shell>
  );
}
