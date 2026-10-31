"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Field, fieldClass } from "@/components/fields";
import { StudioTraffic } from "@/components/studio-traffic";
import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/toast";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { errorText, personName, vnd } from "@/lib/format";
import { useI18n, type Locale } from "@/lib/i18n";
import type { Messages } from "@/lib/messages/vi";
import type { EvalReport, StudioPolicy } from "@/lib/types";

type Tab = "running" | "golden" | "bounds" | "traffic";

const RULE_EVIDENCE: Record<string, { evidence: string; keys: string[] }> = {
  R01: { evidence: "E5", keys: ["max_amount"] },
  R02: { evidence: "E4", keys: ["min_shop_age_months"] },
  R03: { evidence: "E4", keys: ["max_return_rate"] },
  R04: { evidence: "E5", keys: ["min_tenor_weeks", "max_tenor_weeks"] },
  R05: { evidence: "E4 · E8", keys: ["doc_required_multiple", "statement_mismatch_bps"] },
  R06: { evidence: "E6a", keys: ["max_cic_group"] },
  R07: { evidence: "E6a", keys: ["max_outstanding_to_monthly_payout"] },
  R08: { evidence: "E5", keys: ["deduction_cap_of_stress_payout"] },
  R09: { evidence: "E5", keys: ["e_lending_cap"] },
  R10: { evidence: "E6", keys: ["max_pd_bps"] },
};

const MONEY_KEYS = new Set(["max_amount", "e_lending_cap"]);

export default function StudioPage() {
  const { session, ready } = useRequireRole("underwriter", "/studio");
  const { locale, m } = useI18n();
  const [policy, setPolicy] = useState<StudioPolicy | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [picked, setPicked] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("running");
  const [ruleQuery, setRuleQuery] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [outcome, setOutcome] = useState<"all" | "pass" | "fail">("all");

  useEffect(() => {
    if (!session) return;
    Promise.all([api.policy(session.access_token), api.evalMetrics(session.access_token)])
      .then(([policyData, evalData]) => {
        setPolicy(policyData);
        setReport(evalData);
        setRuleId((current) => current || policyData.rules[0]?.rule_id || "");
      })
      .catch((err: unknown) => {
        const text = errorText(err, m.errors, m.common.server);
        setError(text);
        toast(text, "err");
      });
  }, [session, m]);

  const orderedRules = useMemo(() => {
    const list = [...(policy?.rules ?? [])].sort((a, b) => a.order - b.order);
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((rule) => {
      const name = rule.rule_id in m.ruleLong ? m.ruleLong[rule.rule_id as keyof Messages["ruleLong"]] : "";
      const hay = `${rule.rule_id} ${name} ${rule.hard ? m.common.hard : m.common.soft}`.toLowerCase();
      return hay.includes(q);
    });
  }, [policy, ruleQuery, m]);

  const cases = useMemo(() => {
    const list = report?.cases ?? [];
    return list.filter((item) => {
      if (outcome === "pass" && !item.passed) return false;
      if (outcome === "fail" && item.passed) return false;
      const q = caseQuery.trim().toLowerCase();
      if (!q) return true;
      return item.case_id.toLowerCase().includes(q) || item.status.toLowerCase().includes(q) || (item.expected_status ?? "").toLowerCase().includes(q);
    });
  }, [report, caseQuery, outcome]);

  if (!ready || !session) {
    return (
      <Shell active="studio">
        <main className="p-10 text-sm text-slate-600">{m.common.checking}</main>
      </Shell>
    );
  }

  const selectedRule = policy?.rules.find((rule) => rule.rule_id === ruleId) ?? orderedRules[0];
  const selectedCase = report?.cases.find((item) => item.case_id === picked);
  const cicCalled = report?.cases.filter((item) => item.cic_called).length ?? 0;
  const pdScored = report?.cases.filter((item) => item.pd_scored).length ?? 0;
  const passRate = report && report.summary.total ? Math.round((report.summary.passed / report.summary.total) * 1000) / 10 : 0;
  const loading = !policy && !report && !error;

  return (
    <Shell active="studio">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-600 uppercase">{m.studio.kicker}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{m.studio.title}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <ShieldCheck className="h-4 w-4 text-slate-700" aria-hidden />
            <span>
              {m.studio.session} <span className="font-medium text-slate-900">{personName(session)}</span>
            </span>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-6 text-sm text-slate-600">{m.studio.loading}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label={m.studio.goldenCases} value={report ? String(report.summary.total) : "—"} />
          <Metric label={m.studio.matched} value={report ? String(report.summary.passed) : "—"} tone="ok" />
          <Metric label={m.studio.drifted} value={report ? String(report.summary.failed) : "—"} tone={report && report.summary.failed > 0 ? "bad" : "ok"} />
          <Metric label={m.studio.matchRate} value={report ? `${passRate}%` : "—"} />
          <Metric label={m.studio.cicPd} value={report ? `${cicCalled} / ${pdScored}` : "—"} />
        </div>

        <div className="sticky top-14 z-30 -mx-4 mt-6 border-b border-slate-200 bg-slate-50/95 px-4 backdrop-blur sm:-mx-6 sm:px-6" role="tablist" aria-label={m.studio.tabs}>
          <div className="flex gap-1">
            {(
              [
                ["running", m.studio.running],
                ["golden", m.studio.golden],
                ["bounds", m.studio.bounds],
                ["traffic", m.studio.traffic],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`cursor-pointer border-b-2 px-3 py-3 text-sm transition-colors duration-200 ${tab === value ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "running" && policy ? (
          <div className="mt-5 space-y-4">
            <section className="grid min-w-0 gap-4 lg:grid-cols-12">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white lg:col-span-7">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">{m.studio.ruleOrder}</h2>
                  <div className="w-full sm:w-56">
                    <Field label={m.studio.filterRule} htmlFor="rule-query">
                      <input id="rule-query" className={fieldClass()} value={ruleQuery} onChange={(event) => setRuleQuery(event.target.value)} placeholder={m.studio.filterPlaceholder} />
                    </Field>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-xs text-slate-600">
                      <tr>
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Rule</th>
                        <th className="px-3 py-2 font-medium">{m.studio.type}</th>
                        <th className="px-3 py-2 font-medium">{m.studio.evidence}</th>
                        <th className="px-4 py-2 font-medium">{m.studio.liveThreshold}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedRules.map((rule) => {
                        const meta = RULE_EVIDENCE[rule.rule_id];
                        const name = rule.rule_id in m.ruleLong ? m.ruleLong[rule.rule_id as keyof Messages["ruleLong"]] : m.studio.unnamed;
                        const active = selectedRule?.rule_id === rule.rule_id;
                        return (
                          <tr
                            key={rule.rule_id}
                            tabIndex={0}
                            aria-selected={active}
                            className={`cursor-pointer border-t border-slate-100 transition-colors duration-200 ${active ? "bg-slate-900 text-white" : "hover:bg-slate-50"}`}
                            onClick={() => setRuleId(rule.rule_id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setRuleId(rule.rule_id);
                              }
                            }}
                          >
                            <td className="tnum px-4 py-3">{rule.order}</td>
                            <td className="px-3 py-3">
                              <div className="mono text-xs font-medium">{rule.rule_id}</div>
                              <div className={active ? "text-slate-200" : "text-slate-700"}>{name}</div>
                            </td>
                            <td className="px-3 py-3">{rule.hard ? m.studio.hard : m.studio.soft}</td>
                            <td className="mono px-3 py-3 text-xs">{meta?.evidence ?? "—"}</td>
                            <td className="px-4 py-3 text-xs">
                              {(meta?.keys ?? []).map((key) => (
                                <div key={key} className="tnum">
                                  {formatParam(key, policy.policy_config[key], m, locale)}
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {orderedRules.length === 0 ? <p className="px-4 py-6 text-sm text-slate-600">{m.studio.noRule}</p> : null}
              </div>

              <div className="min-w-0 space-y-4 lg:col-span-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-900">{m.studio.locked}</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <Row label="Policy" value={policy.policy_version} />
                    <Row label="Engine" value={policy.engine_version} />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-600">{m.studio.hash}</dt>
                      <dd className="mono mt-1 truncate text-xs text-slate-900" title={policy.policy_hash}>
                        {policy.policy_hash}
                      </dd>
                      <button
                        type="button"
                        className="mt-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-50"
                        onClick={() => {
                          void navigator.clipboard.writeText(policy.policy_hash).then(
                            () => toast(m.studio.copied),
                            () => toast(m.studio.copyFailed, "warn"),
                          );
                        }}
                      >
                        {m.studio.copy}
                      </button>
                    </div>
                  </dl>
                </section>
                {selectedRule ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mono text-xs text-slate-600">{selectedRule.rule_id}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedRule.rule_id in m.ruleLong ? m.ruleLong[selectedRule.rule_id as keyof Messages["ruleLong"]] : selectedRule.rule_id}</h2>
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedRule.hard ? m.studio.hard : m.studio.soft} · {RULE_EVIDENCE[selectedRule.rule_id]?.evidence ?? "—"}
                    </p>
                    <dl className="mt-3 space-y-2">
                      {(RULE_EVIDENCE[selectedRule.rule_id]?.keys ?? []).map((key) => (
                        <div key={key} className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
                          <dt className="text-sm text-slate-700">{key in m.params ? m.params[key as keyof Messages["params"]] : key}</dt>
                          <dd className="tnum text-sm font-semibold text-slate-900">{formatParam(key, policy.policy_config[key], m, locale)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}
                <ParamGroup title={m.studio.pdModel} data={policy.risk_model} />
                <ParamGroup title={m.studio.cicGate} data={policy.cic_gate} />
              </div>
            </section>
            <ParamGroup title={m.studio.policyParams} data={policy.policy_config} />
            <ParamGroup title={m.studio.cashParams} data={policy.cashflow_config} />
          </div>
        ) : null}

        {tab === "golden" && report ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{m.studio.goldenTitle}</h2>
                </div>
                <span className="mono max-w-[12rem] truncate text-[11px] text-slate-600" title={report.golden_digest}>
                  {report.golden_digest}
                </span>
              </div>
              <div className="mt-3">
                <Field label={m.studio.findCase} htmlFor="case-query">
                  <input id="case-query" className={fieldClass()} value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} placeholder={m.studio.findPlaceholder} />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={m.studio.evalResults}>
                {(
                  [
                    ["all", m.studio.all],
                    ["pass", m.studio.pass],
                    ["fail", m.studio.fail],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors duration-200 ${outcome === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => setOutcome(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
                {cases.map((item) => (
                  <li key={item.case_id}>
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-200 ${picked === item.case_id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
                      onClick={() => setPicked(item.case_id)}
                    >
                      <span className="min-w-0">
                        <span className="mono block text-sm font-medium break-all text-slate-900">{item.case_id}</span>
                        <span className="mt-1 inline-flex">
                          <StatusBadge status={item.status} />
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs font-medium ${item.passed ? "text-emerald-700" : "text-rose-700"}`}>{item.passed ? m.studio.pass : m.studio.fail}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {cases.length === 0 ? <p className="mt-4 text-sm text-slate-600">{m.studio.noCase}</p> : null}
            </div>
            <div className="lg:col-span-7">
              {selectedCase ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="mono text-lg font-semibold break-all text-slate-900">{selectedCase.case_id}</h2>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selectedCase.passed ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-rose-300 bg-rose-100 text-rose-800"}`}>
                      {selectedCase.passed ? m.studio.labelMatch : m.studio.labelDrift}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedCase.status} />
                    {selectedCase.expected_status && selectedCase.expected_status !== selectedCase.status ? <StatusBadge status={selectedCase.expected_status} /> : null}
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Fact label="Gap" value={selectedCase.gap == null ? "—" : vnd(selectedCase.gap)} />
                    <Fact label={m.lender.proposal} value={selectedCase.amount_proposed == null ? "—" : vnd(selectedCase.amount_proposed)} />
                    <Fact label="CIC" value={selectedCase.cic_called ? m.studio.cicCalled : m.studio.cicNotCalled} />
                    <Fact label="PD" value={selectedCase.pd_scored ? m.studio.pdScored : m.studio.pdNotScored} />
                  </dl>
                  {selectedCase.mismatched_keys.length ? <p className="mt-4 text-sm text-rose-800">{selectedCase.mismatched_keys.join(", ")}</p> : null}
                </article>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <p className="text-sm font-medium text-slate-800">{m.studio.pickCase}</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "traffic" ? <StudioTraffic token={session.access_token} /> : null}

        {tab === "bounds" ? (
          <div className="mt-5 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">{m.studio.who}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {m.studio.authority.map(([who, does]) => (
                  <div key={who} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="text-sm font-semibold text-slate-900">{who}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{does}</p>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">{m.studio.afterRules}</h2>
              <ul className="mt-4 space-y-3">
                {m.studio.branches.map(([when, status, reason]) => (
                  <li key={when} className="rounded-xl border border-slate-200 px-3 py-3">
                    <div className="text-sm font-medium text-slate-900">{when}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={status} reason={reason || undefined} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">{m.studio.humanDecisions}</h2>
                <ul className="mt-3 space-y-3">
                  {m.studio.decisions.map(([code, text]) => (
                    <li key={code}>
                      <div className="mono text-xs font-medium text-slate-800">{code}</div>
                      <p className="mt-1 text-sm text-slate-600">{text}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">{m.studio.notRunning}</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {m.studio.absent.map((item) => (
                    <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
          </div>
        ) : null}
      </main>
    </Shell>
  );
}

function Metric({ label, value, tone = "idle" }: { label: string; value: string; tone?: "idle" | "ok" | "bad" }) {
  const color = tone === "bad" ? "text-rose-700" : tone === "ok" ? "text-emerald-800" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`tnum mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="mono text-xs text-slate-900">{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="tnum mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ParamGroup({ title, data }: { title: string; data: Record<string, unknown> }) {
  const { locale, m } = useI18n();
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </header>
      <dl>
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="min-w-0 border-t border-slate-100 px-4 py-2.5">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <dt className="min-w-0">
                <div className="text-sm text-slate-800">{key in m.params ? m.params[key as keyof Messages["params"]] : key}</div>
                <div className="mono text-[11px] text-slate-600">{key}</div>
              </dt>
              {isComplex(value) ? null : <dd className="tnum shrink-0 text-sm font-medium text-slate-900">{formatParam(key, value, m, locale)}</dd>}
            </div>
            {isComplex(value) ? (
              <dd className="mt-2 min-w-0">
                <pre className="mono max-h-36 w-full min-w-0 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-800">{JSON.stringify(value, null, 2)}</pre>
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function isComplex(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function formatParam(key: string, value: unknown, messages: Messages, locale: Locale): string {
  const numberLocale = locale === "zh" ? "zh-CN" : locale === "en" ? "en-GB" : "vi-VN";
  if (typeof value === "boolean") return value ? messages.common.yes : messages.common.no;
  if (typeof value === "number") {
    if (MONEY_KEYS.has(key)) return vnd(value);
    const formatted = new Intl.NumberFormat(numberLocale, Number.isInteger(value) ? undefined : { maximumFractionDigits: 4 }).format(value);
    if (key.endsWith("_bps")) return messages.common.bps(formatted);
    if (key.includes("week")) return messages.common.weeks(formatted);
    if (key.includes("month")) return messages.common.months(formatted);
    return formatted;
  }
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([child, childValue]) => `${child}: ${formatParam(child, childValue, messages, locale)}`)
      .join(" · ");
  }
  if (value == null || value === "") return "—";
  return String(value);
}
