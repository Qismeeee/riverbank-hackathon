"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PanelLeftClose, Send } from "lucide-react";
import { CaseRow } from "@/components/case-row";
import { Pagination } from "@/components/pagination";
import { StatementDownloads } from "@/components/statement-downloads";
import { StatementUpload } from "@/components/statement-upload";
import { PlanForm } from "@/components/plan-form";
import { Shell } from "@/components/shell";
import { StatusBadge, statusChrome } from "@/components/status-badge";
import { TimeStamp } from "@/components/time-stamp";
import { toast } from "@/components/toast";
import { api, isAuthError } from "@/lib/api";
import { useAuth, useRequireRole } from "@/lib/auth";
import { caseCode, claimsOf, errorText, idempotencyKey, personName, vnd } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useCaseList } from "@/lib/use-case-list";
import type { Messages } from "@/lib/messages/vi";
import type { ExtractPlanResponse, Plan, SellerView } from "@/lib/types";

type ChatLine = { id: string; role: "user" | "assistant"; text: string };

export default function SellerPage() {
  const { session, ready } = useRequireRole("seller");
  const { logout } = useAuth();
  const { m } = useI18n();
  const [lines, setLines] = useState<ChatLine[]>([{ id: "hello", role: "assistant", text: "" }]);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState<ExtractPlanResponse | null>(null);
  const caseList = useCaseList(session?.access_token, "seller");
  const casesError = caseList.error ? errorText(caseList.error, m.errors, m.common.server) : "";
  const [view, setView] = useState<SellerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotWidth, setCopilotWidth] = useState(360);

  function resizeCopilot(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startW = copilotWidth;
    const move = (ev: PointerEvent) => {
      setCopilotWidth(Math.min(680, Math.max(280, Math.round(startW + ev.clientX - startX))));
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isAuthError(caseList.error)) logout();
  }, [caseList.error, logout]);

  useEffect(() => {
    const node = thread.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines, busy]);

  async function openCase(caseId: string) {
    if (!session) return;
    setOpening(true);
    try {
      setView(await api.sellerView(session.access_token, caseId));
    } catch (err) {
      toast(errorText(err, m.errors, m.common.server), "err");
    } finally {
      setOpening(false);
    }
  }

  async function submitPlan(plan: Plan) {
    if (!session) return;
    if (plan.note.length > 2000) {
      toast(m.seller.noteTooLong, "warn");
      return;
    }
    setBusy(true);
    try {
      const key = idempotencyKey(`case:${JSON.stringify(plan)}`);
      const created = await api.createCase(session.access_token, plan, key);
      const next = await api.sellerView(session.access_token, created.case_id);
      setView(next);
      setPending(null);
      setLines((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: m.seller.calculated },
      ]);
      caseList.refresh(true);
    } catch (err) {
      toast(errorText(err, m.errors, m.common.server), "err");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(event?: FormEvent) {
    event?.preventDefault();
    if (!session || !draftText.trim() || busy) return;
    const message = draftText.trim();
    setDraftText("");
    setLines((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }]);
    setBusy(true);
    try {
      const extracted = await api.extractPlan(session.access_token, session.subject, message);
      setPending(extracted.ready ? extracted : null);
      setLines((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: replyFor(extracted, m) }]);
    } catch (err) {
      const text = errorText(err, m.errors, m.common.server);
      setLines((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text }]);
      toast(text, "err");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !session) {
    return (
      <Shell active="seller">
        <main className="p-10 text-sm text-slate-500">{m.common.checking}</main>
      </Shell>
    );
  }

  const claims = view ? claimsOf(view.explanation) : {};

  return (
    <Shell active="seller">
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className={copilotOpen ? "flex flex-col gap-4 lg:flex-row lg:items-start" : "grid gap-4 lg:grid-cols-12"}>
        {copilotOpen ? (
        <section
          id="seller-copilot"
          className="relative flex h-[min(720px,calc(100vh-7rem))] w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:w-[var(--copilot-width)]"
          style={{ ["--copilot-width" as string]: `${copilotWidth}px` }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Seller Copilot</div>
              <div className="text-xs text-slate-500">{session.display_name?.trim() || personName(session)}</div>
            </div>
            <button
              type="button"
              className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
              aria-expanded="true"
              aria-controls="seller-copilot"
              aria-label={m.seller.close}
              onClick={() => setCopilotOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div ref={thread} className="flex-1 overflow-y-auto p-5 text-sm" aria-live="polite">
            <div className="flex min-h-full flex-col justify-end gap-3">
              {lines.map((line) => {
                const text = line.id === "hello" ? m.seller.greeting : line.text;
                return (
                <div key={line.id} className={line.role === "user" ? "ml-10 rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-white" : "mr-8 flex gap-2"}>
                  {line.role === "assistant" ? (
                    <Image
                      src="/brand/logo-mark.jpg"
                      alt=""
                      width={24}
                      height={24}
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-black/10"
                    />
                  ) : null}
                  <div className={line.role === "assistant" ? "rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 text-slate-700" : ""}>{text}</div>
                </div>
              );
              })}
              {busy ? <p className="text-xs text-slate-400">{m.seller.reading}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-3">
            {(
              [
                [m.seller.presetFull, m.seller.presetFullText],
                [m.seller.presetHalf, m.seller.presetHalfText],
              ] as const
            ).map(([label, text]) => (
              <button
                key={label}
                type="button"
                className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50"
                onClick={() => setDraftText(text)}
              >
                {label}
              </button>
            ))}
          </div>
          <form className="border-t border-slate-100 p-3" onSubmit={sendChat}>
            <label htmlFor="seller-chat" className="text-xs font-medium text-slate-600">
              {m.seller.prompt}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="seller-chat"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm transition duration-200 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                placeholder={m.seller.placeholder}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
              />
              <button
                type="submit"
                disabled={busy || !draftText.trim()}
                className="flex w-11 cursor-pointer items-center justify-center rounded-xl bg-brand-600 text-white transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={m.seller.send}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={280}
            aria-valuemax={680}
            aria-valuenow={copilotWidth}
            aria-label={m.seller.resize}
            tabIndex={0}
            onPointerDown={resizeCopilot}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") setCopilotWidth((width) => Math.min(680, width + 24));
              if (event.key === "ArrowLeft") setCopilotWidth((width) => Math.max(280, width - 24));
            }}
            className="absolute -right-1.5 top-0 z-10 hidden h-full w-3 cursor-col-resize touch-none items-center justify-center lg:flex"
          >
            <span className="h-10 w-1 rounded-full bg-slate-300" />
          </div>
        </section>
        ) : (
          <div className="lg:col-span-12">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50/60"
              aria-expanded="false"
              onClick={() => setCopilotOpen(true)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Image
                  src="/brand/logo-mark.jpg"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-black/10"
                />
                Seller Copilot
              </span>
              <span className="text-xs font-medium text-brand-700">{m.seller.open}</span>
            </button>
          </div>
        )}

        <div className={copilotOpen ? "grid min-w-0 flex-1 gap-4 lg:grid-cols-12" : "contents"}>
        <aside aria-label={m.seller.myCases} className="flex max-h-[42vh] min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-4 lg:h-[min(720px,calc(100vh-7rem))] lg:max-h-[min(720px,calc(100vh-7rem))]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{m.seller.myCases}</h2>
            <button type="button" disabled={caseList.loading} className="cursor-pointer text-xs font-medium text-brand-700 disabled:opacity-40" onClick={() => caseList.refresh(true)}>{m.pagination.refresh}</button>
          </div>
          {caseList.loading ? <p className="mt-2 text-sm text-slate-500" role="status">{m.common.loading}</p> : null}
          {casesError ? <div className="mt-2 text-sm text-rose-600" role="alert"><p>{casesError}</p><button type="button" className="mt-1 cursor-pointer underline" onClick={() => caseList.refresh()}>{m.pagination.retry}</button></div> : null}
          {!caseList.loading && !casesError && caseList.items.length === 0 ? <p className="mt-2 text-sm text-slate-500">{m.seller.noCases}</p> : null}
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-busy={caseList.loading}>
            {caseList.items.map((item) => (
              <li key={item.case_id}>
                <CaseRow item={item} tone="brand" active={view?.case_id === item.case_id} onSelect={() => openCase(item.case_id)} />
              </li>
            ))}
          </ul>
          <Pagination offset={caseList.offset} pageSize={caseList.pageSize} count={caseList.items.length} total={caseList.total} hasMore={caseList.hasMore} loading={caseList.loading} disabled={Boolean(casesError)} onOffsetChange={caseList.setOffset} onPageSizeChange={caseList.setPageSize} />
        </aside>

        <section className="min-h-[16rem] space-y-4 lg:col-span-8 lg:max-h-[min(720px,calc(100vh-7rem))] lg:overflow-y-auto">

          {pending?.ready ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
              <div className="text-sm font-semibold text-slate-900">{m.seller.draftTitle}</div>
              <DraftFacts draft={pending} copy={m.seller} />
              <button
                type="button"
                disabled={busy}
                className="mt-4 cursor-pointer rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  const draft = pending.draft;
                  if (
                    draft.lot_value == null ||
                    draft.cash_on_hand == null ||
                    draft.sell_weeks == null ||
                    draft.requested_amount == null ||
                    !draft.supplier_schedule?.length
                  ) {
                    toast(m.seller.draftMissing, "warn");
                    return;
                  }
                  void submitPlan({
                    seller_id: session.subject,
                    shop_id: session.subject,
                    lot_value: draft.lot_value,
                    cash_on_hand: draft.cash_on_hand,
                    supplier_schedule: draft.supplier_schedule,
                    sell_weeks: draft.sell_weeks,
                    requested_amount: draft.requested_amount,
                    note: "",
                  });
                }}
              >
                {m.seller.submitCalc}
              </button>
            </div>
          ) : null}

          {opening && !view ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">{m.seller.openingCase}</div>
          ) : !view ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-800">{m.seller.noResult}</p>
              <p className="mt-1 text-sm text-slate-600">{m.seller.pickCase}</p>
            </div>
          ) : (
            <div className="relative space-y-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
              <span aria-hidden className={`absolute inset-y-3 left-1.5 w-1 rounded-full ${statusChrome(view.status).rail}`} />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <StatusBadge status={view.status} reason={view.reason} />
                  <TimeStamp iso={view.created_at} label={m.seller.created} />
                  <p className="mono text-xs font-medium text-slate-800">{caseCode(view.case_id)}</p>
                  {caseCode(view.case_id) !== view.case_id ? <p className="mono text-[11px] text-slate-400">{view.case_id}</p> : null}
                </div>
                <span className="mono text-xs text-slate-400">v{view.version}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Fact label={m.seller.gap} value={typeof claims.gap === "number" ? vnd(claims.gap) : "—"} />
                <Fact label={m.seller.proposal} value={typeof claims.amount_proposed === "number" ? vnd(claims.amount_proposed) : view.status === "NO_LOAN_NEEDED" ? m.seller.noLoan : "—"} />
                <Fact label={m.seller.tenor} value={typeof claims.tenor_weeks === "number" ? m.common.weeks(claims.tenor_weeks) : "—"} />
              </div>
              {typeof claims.weekly_deduction === "number" ? <p className="text-sm text-slate-600">{m.seller.maxDeduction(vnd(claims.weekly_deduction))}</p> : null}
              {typeof claims.payout_warning_threshold === "number" ? (
                <p className="text-sm text-slate-600">{m.seller.payoutWarn(vnd(claims.payout_warning_threshold))}</p>
              ) : null}
              <ul className="space-y-2 text-sm text-slate-700">
                {view.explanation.map((sentence) => (
                  <li key={sentence.evidence_id + sentence.template} className="rounded-xl bg-slate-50 px-3 py-2">
                    {sentence.text}
                  </li>
                ))}
              </ul>
              {view.decision ? (
                <p className="text-sm text-slate-700">
                  {m.seller.decision(
                    view.decision.decision_type,
                    view.decision.final_amount != null ? `: ${vnd(view.decision.final_amount)}` : "",
                    view.decision.final_tenor_weeks != null ? `, ${m.common.weeks(view.decision.final_tenor_weeks)}` : "",
                  )}
                </p>
              ) : null}
              {view.statement_file ? (
                <StatementDownloads
                  token={session.access_token}
                  caseId={view.case_id}
                  stored={view.statement_file.stored}
                  mediaType={view.statement_file.media_type}
                  pages={view.statement_file.pages}
                  parser={view.statement_file.parser}
                  lines={view.statement_file.lines}
                />
              ) : null}
              {view.status === "AWAITING_STATEMENT" ? (
                <StatementUpload
                  tone="brand"
                  version={view.version}
                  busy={busy}
                  period={view.statement_period}
                  onSubmit={async ({ periodStart, periodEnd, file }) => {
                    if (!session) return;
                    const before = view.version;
                    setBusy(true);
                    try {
                      const next = await api.uploadStatement(session.access_token, view.case_id, {
                        expected_version: before,
                        period_start: periodStart,
                        period_end: periodEnd,
                        file,
                      });
                      toast(m.seller.reran(before, next.version));
                      setView(await api.sellerView(session.access_token, view.case_id));
                      caseList.refresh();
                    } catch (err) {
                      toast(errorText(err, m.errors, m.common.server), "err");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ) : null}
              {view.status === "ACCEPTED" || view.status === "REJECTED" ? (
                <p className="text-sm text-slate-600">{m.seller.los}</p>
              ) : null}
              {view.status === "ESCALATED" ? <p className="text-sm text-rose-700">{m.seller.bankHandling}</p> : null}
            </div>
          )}

        </section>
        </div>
        </div>

        <PlanForm sellerId={session.subject} busy={busy} onSubmit={(plan) => void submitPlan(plan)} />
      </main>
    </Shell>
  );
}

function fieldName(copy: Messages["seller"], name: string): string {
  return name in copy.fields ? copy.fields[name as keyof typeof copy.fields] : name;
}

function hiddenParts(copy: Messages["seller"], sanitized: string): string[] {
  return (Object.keys(copy.hidden) as (keyof typeof copy.hidden)[]).flatMap((tag) => (sanitized.includes(tag) ? [copy.hidden[tag]] : []));
}

function replyFor(extracted: ExtractPlanResponse, messages: Messages): string {
  const copy = messages.seller;
  const hidden = hiddenParts(copy, extracted.sanitized_message ?? "");
  const draft = extracted.draft;
  const captured = [draft?.lot_value, draft?.cash_on_hand, draft?.supplier_schedule, draft?.sell_weeks, draft?.requested_amount].some(
    (value) => value != null,
  );
  if (hidden.length && !captured) return copy.noKeep(hidden.join(", "));
  const note = hidden.length ? copy.dropped(hidden.join(", ")) : "";
  if (!extracted.ready) {
    const missing = extracted.missing_fields ?? [];
    const issues = extracted.issues ?? [];
    const question = missing.length ? copy.askMore(missing.map((name) => fieldName(copy, name)).join(", ")) : copy.notEnough;
    const issueText = issues.length ? copy.needFix(issues.map((issue) => fieldName(copy, issue.field)).join(", ")) : "";
    return `${note}${question}${issueText}`;
  }
  const schedule = draft.supplier_schedule?.map((row) => copy.weekAmount(row.week, vnd(row.amount))).join(", ") || copy.unclear;
  return `${note}${copy.readPlan(vnd(draft.lot_value), vnd(draft.cash_on_hand), String(draft.sell_weeks ?? "?"), vnd(draft.requested_amount), schedule)}`;
}

function DraftFacts({ draft, copy }: { draft: ExtractPlanResponse; copy: Messages["seller"] }) {
  const plan = draft.draft;
  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div>{copy.lot}: {typeof plan.lot_value === "number" ? vnd(plan.lot_value) : "—"}</div>
      <div>{copy.cash}: {typeof plan.cash_on_hand === "number" ? vnd(plan.cash_on_hand) : "—"}</div>
      <div>{copy.sellWeeks}: {plan.sell_weeks ?? "—"}</div>
      <div>{copy.ask}: {typeof plan.requested_amount === "number" ? vnd(plan.requested_amount) : "—"}</div>
      <div className="sm:col-span-2">
        {copy.schedule}: {plan.supplier_schedule?.map((row) => copy.weekAmount(row.week, vnd(row.amount))).join(", ") || "—"}
      </div>
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

