"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { caseCode, clock, errorText, statusLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { TrafficReport } from "@/lib/types";

export function StudioTraffic({ token }: { token: string }) {
  const { locale, m } = useI18n();
  const [report, setReport] = useState<TrafficReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setReport(null);
    setError("");
    api
      .traffic(token)
      .then((next) => {
        if (!cancel) setReport(next);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(errorText(err, m.errors, m.common.server));
      });
    return () => {
      cancel = true;
    };
  }, [token, m]);

  if (error) {
    return (
      <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
        {error}
      </p>
    );
  }
  if (!report) return <p className="mt-6 text-sm text-slate-600">{m.studio.loadingTraffic}</p>;

  const numberLocale = locale === "zh" ? "zh-CN" : locale === "en" ? "en-GB" : "vi-VN";
  const money = (micro: number) =>
    (micro / 1_000_000).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const secondsOnly = (ms: number) =>
    (ms / 1000).toLocaleString(numberLocale, { maximumFractionDigits: ms < 10000 ? 1 : 0 });
  const showSeconds = (ms: number) => m.studio.seconds(secondsOnly(ms));
  const latency = report.summary.latency_ms;
  const cost = report.summary.cost;
  const peak = Math.max(1, ...report.by_day.map((day) => day.cases));
  const costHints = [
    cost.p50_micro_usd == null ? null : `p50 ${money(cost.p50_micro_usd)} USD`,
    cost.unknown_cases > 0 ? m.studio.costKnown(cost.known_cases, report.summary.cases) : null,
  ].filter((hint): hint is string => Boolean(hint));

  return (
    <div className="mt-5 space-y-4">
      <p className="max-w-3xl text-sm text-slate-600">{m.studio.trafficLead}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label={m.studio.totalCases}
          value={String(report.summary.cases)}
          hint={m.studio.measured(report.summary.measured_runs, report.summary.cases)}
        />
        <Card label={m.studio.openedToday} value={String(report.summary.opened_today)} />
        <Card
          label={m.studio.medianTime}
          value={latency.p50 == null ? "—" : showSeconds(latency.p50)}
          hint={latency.p95 == null ? undefined : `${m.studio.p95Time} ${showSeconds(latency.p95)}`}
        />
        <Card
          label={m.studio.costTitle}
          value={cost.total_micro_usd == null ? "—" : `${money(cost.total_micro_usd)} USD`}
          hint={cost.total_micro_usd == null ? m.studio.costMissing : costHints.join(" · ") || undefined}
        />
      </div>
      <p className="text-xs text-slate-500">
        {m.studio.budget(secondsOnly(report.targets.latency_ms), money(report.targets.cost_micro_usd))}
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{m.studio.perDay}</h2>
        {report.by_day.length === 0 ? <p className="mt-3 text-sm text-slate-600">{m.studio.noCase}</p> : null}
        <div className="mt-4 flex items-end gap-2 overflow-x-auto">
          {report.by_day.map((day) => (
            <div key={day.day} className="flex w-12 shrink-0 flex-col items-center gap-1">
              <span className="tnum text-[11px] font-semibold text-slate-800">{day.cases}</span>
              <div className="flex h-28 w-full items-end rounded-lg bg-slate-50">
                <div className="w-full rounded-lg bg-slate-900" style={{ height: `${Math.max(8, (day.cases / peak) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-slate-500">{day.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{m.studio.byStatus}</h2>
          <ul className="mt-3 space-y-2">
            {report.by_status.map((row) => (
              <li key={row.status} className="flex items-center justify-between gap-3">
                <StatusBadge status={row.status} />
                <span className="tnum text-sm font-semibold text-slate-900">{row.cases}</span>
                <span className="sr-only">{statusLabel(row.status, null, m.status, m.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{m.studio.models}</h2>
          {report.by_model.length === 0 ? <p className="mt-3 text-sm text-slate-600">{m.studio.noModel}</p> : null}
          <ul className="mt-3 space-y-2 text-sm">
            {report.by_model.map((row) => (
              <li key={row.model} className="flex items-baseline justify-between gap-3">
                <span className="mono min-w-0 truncate text-slate-800">{row.model}</span>
                <span className="tnum shrink-0 font-semibold text-slate-900">{row.calls}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{m.studio.recent}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{m.studio.totalCases}</th>
                <th className="px-3 py-2 font-medium">{m.studio.byStatus}</th>
                <th className="px-3 py-2 font-medium">{m.studio.openedCol}</th>
                <th className="px-3 py-2 font-medium">{m.studio.timeCol}</th>
                <th className="px-3 py-2 font-medium">{m.studio.costTitle}</th>
                <th className="px-4 py-2 font-medium">{m.studio.modelCol}</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((row) => (
                <tr key={row.case_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.seller_id}</div>
                    <div className="mono text-[11px] text-slate-500">{caseCode(row.case_id)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={row.status} reason={row.reason} />
                  </td>
                  <td className="tnum px-3 py-3 text-slate-700">{clock(row.created_at, locale)}</td>
                  <td className="tnum px-3 py-3 text-slate-900">
                    {row.first_run?.duration_ms == null ? m.studio.unknownTime : showSeconds(row.first_run.duration_ms)}
                  </td>
                  <td className="tnum px-3 py-3 text-slate-900">
                    {row.cost_known && row.cost_micro_usd != null ? `${money(row.cost_micro_usd)} USD` : "—"}
                  </td>
                  <td className="mono px-4 py-3 text-xs text-slate-700">{row.models.length ? row.models.join(", ") : m.studio.noModel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}
