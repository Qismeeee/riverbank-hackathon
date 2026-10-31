"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CashChart, loanSeries } from "@/components/cash-chart";
import { StatementDownloads, statementFacts, statementStored, uploadedStatement } from "@/components/statement-downloads";
import { StatementUpload } from "@/components/statement-upload";
import { Field, fieldClass } from "@/components/fields";
import { HoldButton } from "@/components/hold-button";
import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { TimeStamp } from "@/components/time-stamp";
import { toast } from "@/components/toast";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { caseCode, displayDate, errorText, idempotencyKey, parseVnd, payoutPeriod, vnd } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Messages } from "@/lib/messages/vi";
import type { CaseDetail, DecisionType, Evidence, PolicyResult } from "@/lib/types";

export default function LenderCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { session, ready } = useRequireRole("underwriter");
  const { m } = useI18n();
  const [caseId, setCaseId] = useState("");
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [counter, setCounter] = useState(false);
  const [amount, setAmount] = useState("");
  const [tenor, setTenor] = useState("");
  const [statement, setStatement] = useState({ start: "", end: "", total: "", ref: "" });
  const [cicReason, setCicReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void params.then((value) => setCaseId(value.caseId));
  }, [params]);

  const load = useCallback(async () => {
    if (!session || !caseId) return;
    const next = await api.caseDetail(session.access_token, caseId);
    setDetail(next);
    const proposed = next.runs.at(-1)?.cashflow?.amount_proposed;
    const weeks = next.runs.at(-1)?.cashflow?.tenor_weeks;
    if (proposed) setAmount(String(proposed));
    if (weeks) setTenor(String(weeks));
  }, [session, caseId]);

  useEffect(() => {
    if (!session || !caseId) return;
    load().catch((err: unknown) => setError(errorText(err, m.errors, m.common.server)));
  }, [session, caseId, load, m]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      const text = errorText(err, m.errors, m.common.server);
      setError(text);
      toast(text, "err");
      if (err instanceof Error && "code" in err && err.code === "CASE_VERSION_CONFLICT") await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !session) {
    return (
      <Shell active="lender">
        <main className="p-10 text-sm text-slate-500">{m.common.checking}</main>
      </Shell>
    );
  }

  const runLast = detail?.runs.at(-1);
  const uploaded = detail ? uploadedStatement(detail.runs) : null;
  const uploadedFacts = uploaded ? statementFacts(uploaded) : null;
  const cashflow = runLast?.cashflow;
  const memo = detail?.documents.at(-1);
  const canDecide = detail?.status === "PENDING_REVIEW" || detail?.status === "ESCALATED";
  const needsNote = detail?.status === "ESCALATED";
  const showStatement =
    detail?.status === "AWAITING_STATEMENT" ||
    (detail?.status === "ESCALATED" && runLast?.policy?.results.some((rule) => rule.rule_id === "R05" && !rule.passed));
  const period = showStatement ? payoutPeriod(runLast) : null;
  const showCic = detail?.status === "ESCALATED" && runLast?.cic?.source === "not_queried" && !detail.decision;
  const handoffStatus = detail?.handoff?.status;

  function openEvidence(evidenceId: string) {
    if (!detail || !session) return;
    setSelected(evidenceId);
    api
      .evidence(session.access_token, detail.case_id, evidenceId)
      .then(setEvidence)
      .catch((err: unknown) => toast(errorText(err, m.errors, m.common.server), "err"));
  }

  async function decide(type: DecisionType) {
    if (!detail || !session) return;
    if (!reason.trim()) {
      setError(m.lender.needReason);
      return;
    }
    if (needsNote && type !== "REJECT" && !note.trim()) {
      setError(m.lender.needNote);
      return;
    }
    const body: {
      expected_version: number;
      decision_type: DecisionType;
      final_amount?: number;
      final_tenor_weeks?: number;
      verification_note: string;
      reason: string;
    } = {
      expected_version: detail.version,
      decision_type: type,
      verification_note: note.trim(),
      reason: reason.trim(),
    };
    if (type === "ACCEPT_COUNTER") {
      const finalAmount = parseVnd(amount);
      const finalTenor = Number(tenor);
      if (finalAmount == null || !Number.isInteger(finalTenor)) {
        setError(m.lender.needInteger);
        return;
      }
      body.final_amount = finalAmount;
      body.final_tenor_weeks = finalTenor;
    }
    const key = idempotencyKey(`decision:${detail.case_id}:${JSON.stringify(body)}`);
    await run(async () => {
      const decided = await api.decision(session.access_token, detail.case_id, key, body);
      toast(m.lender.decisionSaved, "ok");
      try {
        await api.handoff(session.access_token, detail.case_id, decided.version);
        toast(m.lender.handed, "ok");
      } catch (err) {
        toast(m.lender.handoffPending(errorText(err, m.errors, m.common.server)), "warn");
      }
    });
  }

  return (
    <Shell active="lender">
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-12 sm:px-6">
        <div className="lg:col-span-12">
          <Link href="/lender" className="text-sm text-teal-700">
            {m.lender.back}
          </Link>
        </div>
        {!detail ? (
          <p className="text-sm text-slate-500 lg:col-span-12">{error || m.lender.loadingCase}</p>
        ) : (
          <>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">{detail.seller_id}</h1>
                  <p className="mono text-xs text-slate-700">
                    <span className="font-medium">{caseCode(detail.case_id)}</span>
                    <span className="text-slate-400"> · {m.common.version(detail.version)}</span>
                  </p>
                  {caseCode(detail.case_id) !== detail.case_id ? <p className="mono text-[11px] text-slate-400">{detail.case_id}</p> : null}
                  <div className="mt-1">
                    <TimeStamp iso={detail.created_at} label={m.lender.created} />
                  </div>
                </div>
                <StatusBadge status={detail.status} reason={detail.reason} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <Info label={m.lender.requested} value={vnd(detail.plan.requested_amount)} />
                <Info label={m.lender.gap} value={cashflow ? vnd(cashflow.gap) : "—"} />
                <Info label={m.lender.proposal} value={cashflow ? `${vnd(cashflow.amount_proposed)} · ${m.common.weeks(cashflow.tenor_weeks)}` : "—"} />
              </div>
              {uploaded && uploadedFacts ? (
                <StatementDownloads
                  token={session.access_token}
                  caseId={detail.case_id}
                  stored={statementStored(uploaded)}
                  statement={uploaded}
                  mediaType={uploadedFacts.mediaType}
                  pages={uploadedFacts.pages}
                  parser={uploadedFacts.parser}
                  lines={uploadedFacts.lines}
                />
              ) : null}
              {cashflow?.weeks?.length ? (
                <div>
                  <CashChart
                    weeks={cashflow.weeks.map((week) => ({ week: week.week, value: week.bal_end }))}
                    stress={cashflow.stress_weeks?.map((week) => week.bal_end)}
                    loan={cashflow.gap > 0 ? loanSeries(cashflow.weeks, cashflow.amount_proposed, cashflow.weekly_deductions) : null}
                  />
                  <p className="text-xs text-slate-600">{m.lender.chart}</p>
                </div>
              ) : null}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{m.lender.memo}</h2>
                  {memo?.created_at ? <TimeStamp iso={memo.created_at} label={m.lender.memoAt} /> : null}
                </div>
                {memo && !memo.validated ? <p className="mt-1 text-xs text-amber-700">{m.lender.memoUnchecked}</p> : null}
                <ul className="mt-2 space-y-2">
                  {(memo?.underwriter_memo ?? []).map((sentence) => (
                    <li key={`${sentence.evidence_id}-${sentence.template}`}>
                      {sentence.template === "policy" ? (
                        <RuleBoard
                          results={runLast?.policy?.results?.length ? runLast.policy.results : parseRuleSummary(sentence.text)}
                          selected={selected === sentence.evidence_id}
                          onOpen={() => openEvidence(sentence.evidence_id)}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition-colors duration-200 ${selected === sentence.evidence_id ? "bg-teal-50 ring-1 ring-teal-300" : "bg-slate-50 hover:bg-slate-100"}`}
                          onClick={() => openEvidence(sentence.evidence_id)}
                        >
                          <MoneyText text={sentence.text} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {runLast?.policy && !memo?.underwriter_memo.some((sentence) => sentence.template === "policy") ? (
                <RuleBoard results={runLast.policy.results} />
              ) : null}
              {runLast?.risk ? (
                <p className="text-sm text-slate-600">
                  PD {runLast.risk.pd_bps == null ? m.lender.pdMissing : m.lender.pdPoints(runLast.risk.pd_bps)} · {runLast.risk.model_version} · {runLast.risk.source}
                  {runLast.risk.missing_fields?.length ? ` · ${m.lender.missing(runLast.risk.missing_fields.join(", "))}` : ""}
                </p>
              ) : null}
              {runLast?.cic ? (
                <div className="space-y-1 text-sm text-slate-600">
                  <p>
                    <MoneyText
                      text={`CIC ${runLast.cic.source}${runLast.cic.bureau_group ? ` · ${m.lender.cicGroup(runLast.cic.bureau_group)}` : ""}${
                        runLast.cic.outstanding != null ? ` · ${m.lender.cicOutstanding(vnd(runLast.cic.outstanding))}` : ""
                      }`}
                    />
                  </p>
                  {runLast.cic.queried_at ? <TimeStamp iso={runLast.cic.queried_at} label={m.lender.cicAt} /> : null}
                </div>
              ) : null}
              {detail.decision ? (
                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    {m.lender.decidedVerb}: {String(detail.decision.decision_type)} ·{" "}
                    {detail.decision.final_amount != null ? (
                      <strong className="font-bold text-slate-950">{vnd(Number(detail.decision.final_amount))}</strong>
                    ) : (
                      m.lender.noDisburse
                    )}
                  </p>
                  {typeof detail.decision.decided_at === "string" ? <TimeStamp iso={detail.decision.decided_at} label={m.lender.decidedAt} /> : null}
                  {typeof detail.decision.expires_at === "string" ? <TimeStamp iso={detail.decision.expires_at} label={m.lender.expires} /> : null}
                </div>
              ) : null}
              {detail.handoff ? (
                <p className="text-sm text-slate-600">
                  LOS {detail.handoff.status}
                  {detail.handoff.los_reference ? ` · ${detail.handoff.los_reference}` : ""}
                  {detail.handoff.last_error ? ` · ${detail.handoff.last_error}` : ""}
                </p>
              ) : null}
              {(detail.status === "ACCEPTED" || detail.status === "REJECTED") && handoffStatus !== "SUCCEEDED" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() =>
                    run(async () => {
                      await api.handoff(session.access_token, detail.case_id, detail.version);
                      toast(m.lender.handed, "ok");
                    })
                  }
                >
                  {m.lender.handoffAgain}
                </button>
              ) : null}
            </section>

            <aside className="space-y-4 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">{m.lender.evidence} {evidence?.code ?? ""}</h2>
                {!evidence ? <p className="mt-2 text-sm text-slate-500">{m.lender.evidenceEmpty}</p> : null}
                {evidence ? (
                  <>
                    <div className="mt-2">
                      <TimeStamp iso={evidence.created_at} label={m.lender.recorded} />
                    </div>
                    <p className="mono mt-2 text-[10px] text-slate-400">{evidence.payload_hash}</p>
                    <pre className="mono mt-3 max-h-80 overflow-auto text-xs text-slate-700">{JSON.stringify(evidence.payload, null, 2)}</pre>
                  </>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">{m.lender.journal}</h2>
                <ol className="mt-3 max-h-64 space-y-3 overflow-y-auto text-xs">
                  {[...detail.events].reverse().map((event) => (
                    <li key={event.event_id}>
                      <TimeStamp iso={event.occurred_at} />
                      <div className="text-slate-500">{event.actor}</div>
                      <div className="text-slate-700">
                        {event.event_type}
                        {event.next_status ? ` → ${event.next_status}` : ""}
                        {event.reason ? ` · ${event.reason}` : ""}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {showStatement ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <StatementUpload
                    tone="teal"
                    version={detail.version}
                    busy={busy}
                    period={period}
                    onSubmit={async ({ periodStart, periodEnd, file }) => {
                      const before = detail.version;
                      await run(async () => {
                        const next = await api.uploadStatement(session.access_token, detail.case_id, {
                          expected_version: before,
                          period_start: periodStart,
                          period_end: periodEnd,
                          file,
                        });
                        toast(m.lender.reran(before, next.version));
                      });
                    }}
                  />
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const total = parseVnd(statement.total);
                    const periodStart = period?.start || statement.start;
                    const periodEnd = period?.end || statement.end;
                    if (!periodStart || !periodEnd || periodEnd <= periodStart) {
                      setError(m.lender.periodInvalid);
                      return;
                    }
                    if (total == null || !statement.ref.trim() || statement.ref.trim().length > 500) {
                      setError(m.lender.needStatementTotal);
                      return;
                    }
                    const before = detail.version;
                    void run(async () => {
                      const next = await api.statement(session.access_token, detail.case_id, {
                        expected_version: before,
                        period_start: periodStart,
                        period_end: periodEnd,
                        marketplace_total: total,
                        document_ref: statement.ref.trim(),
                      });
                      toast(m.lender.reran(before, next.version));
                    });
                  }}
                  className="space-y-4 border-t border-slate-200 pt-4"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{m.lender.manualTitle}</h2>
                    <p className="mt-1 text-xs text-slate-600">{m.lender.manualLead}</p>
                  </div>
                  {period ? (
                    <p className="text-sm text-slate-700">{m.statement.periodLocked(displayDate(period.start), displayDate(period.end))}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={m.statement.start} htmlFor="stmt-start" hint={m.lender.monday}>
                        <input id="stmt-start" type="date" className={fieldClass("teal")} value={statement.start} onChange={(event) => setStatement({ ...statement, start: event.target.value })} required />
                      </Field>
                      <Field label={m.statement.end} htmlFor="stmt-end" hint={m.lender.exclusive} error={statement.start && statement.end && statement.end <= statement.start ? m.lender.afterStart : undefined}>
                        <input id="stmt-end" type="date" className={fieldClass("teal")} value={statement.end} onChange={(event) => setStatement({ ...statement, end: event.target.value })} required />
                      </Field>
                    </div>
                  )}
                  <Field label={m.lender.marketplaceTotal} htmlFor="stmt-total" hint={m.lender.totalHint}>
                    <input id="stmt-total" inputMode="numeric" className={fieldClass("teal")} placeholder="120000000" value={statement.total} onChange={(event) => setStatement({ ...statement, total: event.target.value })} />
                    <p className="mt-1 text-xs text-slate-500">{m.lender.readAs(parseVnd(statement.total) == null ? "—" : vnd(parseVnd(statement.total) ?? 0))}</p>
                  </Field>
                  <Field label={m.lender.docRef} htmlFor="stmt-ref" hint={m.lender.docHint}>
                    <input id="stmt-ref" className={fieldClass("teal")} maxLength={500} value={statement.ref} onChange={(event) => setStatement({ ...statement, ref: event.target.value })} />
                  </Field>
                  <button type="submit" disabled={busy} className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                    {busy ? m.lender.comparing : m.lender.compare}
                  </button>
                </form>
                </div>
              ) : null}

              {showCic ? (
                <form
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!cicReason.trim()) {
                      setError(m.lender.cicNeedReason);
                      return;
                    }
                    void run(async () => {
                      await api.cicInquiry(session.access_token, detail.case_id, {
                        expected_version: detail.version,
                        reason: cicReason.trim(),
                      });
                      toast(m.lender.cicDone, "ok");
                    });
                  }}
                >
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{m.lender.cicTitle}</h2>
                    <p className="mt-1 text-xs text-slate-600">{m.lender.cicLead}</p>
                  </div>
                  <Field label={m.lender.cicReason} htmlFor="cic-reason" hint={m.lender.cicReasonHint}>
                    <textarea id="cic-reason" className={fieldClass("teal")} rows={3} maxLength={2000} value={cicReason} onChange={(event) => setCicReason(event.target.value)} required />
                    <p className="mt-1 text-right text-[11px] text-slate-400">{cicReason.length}/2000</p>
                  </Field>
                  <button type="submit" disabled={busy || !cicReason.trim()} className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                    {busy ? m.lender.cicBusy : m.lender.cicSubmit}
                  </button>
                </form>
              ) : null}

              {canDecide ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{m.lender.decisionTitle}</h2>
                    <p className="mt-1 text-xs text-slate-600">{m.lender.decisionLead}</p>
                  </div>
                  <Field label={m.lender.reason} htmlFor="decision-reason" hint={m.lender.reasonHint} error={!reason.trim() && error === m.lender.needReason ? m.lender.needReason : undefined}>
                    <textarea id="decision-reason" className={fieldClass("teal")} rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
                    <p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/2000</p>
                  </Field>
                  {needsNote ? (
                    <Field label={m.lender.note} htmlFor="decision-note" hint={m.lender.noteHint}>
                      <textarea id="decision-note" className={fieldClass("teal")} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
                      <p className="mt-1 text-right text-[11px] text-slate-400">{note.length}/2000</p>
                    </Field>
                  ) : null}
                  {counter ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={m.lender.finalAmount} htmlFor="decision-amount" hint={m.lender.amountHint}>
                        <input id="decision-amount" inputMode="numeric" className={fieldClass("teal")} value={amount} onChange={(event) => setAmount(event.target.value)} />
                        <p className="mt-1 text-xs text-slate-500">{m.lender.readAs(parseVnd(amount) == null ? "—" : vnd(parseVnd(amount) ?? 0))}</p>
                      </Field>
                      <Field label={m.lender.weeks} htmlFor="decision-tenor" hint={m.lender.weeksHint}>
                        <input id="decision-tenor" type="number" inputMode="numeric" className={fieldClass("teal")} value={tenor} onChange={(event) => setTenor(event.target.value)} />
                      </Field>
                    </div>
                  ) : null}
                  <HoldButton label={counter ? m.lender.holdCounter : m.lender.holdProposal} disabled={busy || !reason.trim()} onHold={() => void decide(counter ? "ACCEPT_COUNTER" : "ACCEPT_PROPOSAL")} />
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors duration-200 hover:bg-slate-50" onClick={() => setCounter((value) => !value)}>
                      {counter ? m.lender.useProposal : m.lender.editNumbers}
                    </button>
                    <button type="button" className="cursor-pointer rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700 transition-colors duration-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !reason.trim()} onClick={() => void decide("REJECT")}>
                      {m.lender.reject}
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <p className="text-sm text-rose-600" role="alert">
                  {error}
                </p>
              ) : null}
            </aside>
          </>
        )}
      </main>
    </Shell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="tnum text-lg font-bold tracking-tight text-slate-950">
        <MoneyText text={value} />
      </div>
    </div>
  );
}

function ruleName(id: string, rules: Messages["rules"]): string {
  return id in rules ? rules[id as keyof Messages["rules"]] : id;
}

function MoneyText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/(\d{1,3}(?:\.\d{3})+(?:\s*(?:VND|vnđ|₫|đồng|đ))?|\d{1,3}(?:,\d{3})+(?:\s*(?:VND|vnđ|₫|đồng|đ))?|\d{4,}\s*(?:VND|vnđ|₫|đồng|đ))/gi)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    nodes.push(
      <strong key={`${index}-${match[0]}`} className="font-bold text-slate-950">
        {match[0]}
      </strong>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function parseRuleSummary(text: string): PolicyResult[] {
  return [...text.matchAll(/(R\d{2})\s*:\s*(đạt|cần xử lý)/gi)].map((match) => ({
    rule_id: match[1].toUpperCase(),
    hard: false,
    passed: match[2].toLocaleLowerCase("vi") === "đạt",
    reason: "",
  }));
}

function RuleChip({ rule }: { rule: PolicyResult }) {
  const { m } = useI18n();
  return (
    <li className={`rounded-lg border px-2.5 py-2 ${rule.passed ? "border-emerald-200 bg-white" : "border-rose-200 bg-rose-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-xs font-bold text-slate-950">{rule.rule_id}</span>
        <span className={`text-[11px] font-semibold ${rule.passed ? "text-emerald-700" : "text-rose-700"}`}>{rule.passed ? m.common.pass : m.common.needsWork}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
        {ruleName(rule.rule_id, m.rules)}
        {rule.hard ? ` · ${m.common.hard}` : ""}
      </p>
      {!rule.passed && rule.reason ? (
        <p className="mt-1 text-[11px] leading-4 text-rose-800">
          <MoneyText text={rule.reason} />
        </p>
      ) : null}
    </li>
  );
}

function RuleBoard({ results, selected = false, onOpen }: { results: PolicyResult[]; selected?: boolean; onOpen?: () => void }) {
  const { m } = useI18n();
  const failed = results.filter((rule) => !rule.passed);
  const passed = results.filter((rule) => rule.passed);
  return (
    <div className={`rounded-xl border p-3 ${selected ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">{m.lender.policy}</p>
        <p className="text-xs">
          <span className="font-semibold text-emerald-700">{m.lender.passedCount(passed.length)}</span>
          <span className="mx-1 text-slate-300">·</span>
          <span className={failed.length ? "font-semibold text-rose-700" : "text-slate-500"}>{m.lender.failedCount(failed.length)}</span>
        </p>
      </div>
      {failed.length ? (
        <ul className="mt-2 grid gap-1.5">
          {failed.map((rule) => (
            <RuleChip key={rule.rule_id} rule={rule} />
          ))}
        </ul>
      ) : null}
      {passed.length ? (
        <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {passed.map((rule) => (
            <RuleChip key={rule.rule_id} rule={rule} />
          ))}
        </ul>
      ) : null}
      {onOpen ? (
        <button type="button" className="mt-2 cursor-pointer text-xs font-medium text-teal-700 hover:text-teal-900" onClick={onOpen}>
          {m.lender.evidenceLink}
        </button>
      ) : null}
    </div>
  );
}
