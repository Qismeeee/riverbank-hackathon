"use client";

import { FormEvent, useMemo, useState } from "react";
import { Field, fieldClass } from "@/components/fields";
import { planFromTrieu, vnd } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Messages } from "@/lib/messages/vi";
import type { Plan } from "@/lib/types";

type Draft = {
  lotTr: number;
  cashTr: number;
  depositPct: number;
  remWeek: number;
  sellWeeks: number;
  declareAsk: boolean;
  requestedTr: number;
  note: string;
};

const INITIAL: Draft = {
  lotTr: 200,
  cashTr: 120,
  depositPct: 100,
  remWeek: 4,
  sellWeeks: 6,
  declareAsk: false,
  requestedTr: 150,
  note: "",
};

function toPlan(sellerId: string, form: Draft): Plan {
  return planFromTrieu({
    sellerId,
    lotTr: form.lotTr,
    cashTr: form.cashTr,
    depositPct: form.depositPct,
    remWeek: form.remWeek,
    sellWeeks: form.sellWeeks,
    requestedTr: form.declareAsk ? form.requestedTr : null,
    note: form.note,
  });
}

export function PlanForm({ sellerId, busy, onSubmit }: { sellerId: string; busy: boolean; onSubmit: (plan: Plan) => void }) {
  const { m } = useI18n();
  const [form, setForm] = useState<Draft>(INITIAL);
  const [attempted, setAttempted] = useState(false);
  const errors = useMemo(() => validate(form, m.plan), [form, m]);
  const ready = Object.keys(errors).length === 0;
  const preview = ready ? toPlan(sellerId, form) : null;

  function patch(partial: Partial<Draft>) {
    setForm((current) => {
      const next = { ...current, ...partial };
      if (next.sellWeeks < 1) next.sellWeeks = 1;
      if (next.remWeek > next.sellWeeks) next.remWeek = next.sellWeeks;
      if (next.remWeek < 1) next.remWeek = 1;
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!ready) return;
    onSubmit(toPlan(sellerId, form));
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{m.plan.title}</h2>
          <p className="mt-1 text-xs text-slate-600">{m.plan.unit}</p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => {
            setForm(INITIAL);
            setAttempted(false);
          }}
        >
          {m.plan.reset}
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.plan.lotCash}</legend>
            <SliderField
              id="lot"
              label={m.plan.lot}
              hint={m.plan.lotHint}
              value={form.lotTr}
              min={10}
              max={500}
              step={10}
              suffix={m.plan.million}
              error={attempted ? errors.lotTr : undefined}
              onChange={(lotTr) => patch({ lotTr })}
            />
            <SliderField
              id="cash"
              label={m.plan.cash}
              hint={m.plan.cashHint}
              value={form.cashTr}
              min={0}
              max={400}
              step={10}
              suffix={m.plan.million}
              error={attempted ? errors.cashTr : undefined}
              onChange={(cashTr) => patch({ cashTr })}
            />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.plan.schedule}</legend>
            <SliderField
              id="deposit"
              label={m.plan.deposit}
              hint={m.plan.depositHint}
              value={form.depositPct}
              min={0}
              max={100}
              step={5}
              suffix="%"
              error={attempted ? errors.depositPct : undefined}
              onChange={(depositPct) => patch({ depositPct })}
            />
            {form.depositPct < 100 ? (
              <SliderField
                id="rem"
                label={m.plan.remWeek}
                hint={m.plan.remHint}
                value={form.remWeek}
                min={1}
                max={Math.max(1, form.sellWeeks)}
                step={1}
                suffix=""
                display={m.common.weekN(form.remWeek)}
                error={attempted ? errors.remWeek : undefined}
                onChange={(remWeek) => patch({ remWeek })}
              />
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{m.plan.paidAll}</p>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.plan.sellAsk}</legend>
            <SliderField
              id="weeks"
              label={m.plan.sellWeeks}
              hint={m.plan.sellHint}
              value={form.sellWeeks}
              min={1}
              max={26}
              step={1}
              suffix={m.plan.week}
              error={attempted ? errors.sellWeeks : undefined}
              onChange={(sellWeeks) => patch({ sellWeeks })}
            />
            <div>
              <div className="flex items-start gap-2.5">
                <input
                  id="declare-ask"
                  type="checkbox"
                  checked={form.declareAsk}
                  onChange={(event) => patch({ declareAsk: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#ea580c]"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor="declare-ask" className="block cursor-pointer text-sm font-medium text-slate-800">
                    {m.plan.ask}
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">{form.declareAsk ? m.plan.askHint : m.plan.askOffHint}</p>
                </div>
              </div>
              {form.declareAsk ? (
                <div className="mt-2 pl-6">
                  <SliderField
                    id="ask"
                    label={m.plan.ask}
                    bare
                    value={form.requestedTr}
                    min={1}
                    max={300}
                    step={1}
                    suffix={m.plan.million}
                    error={attempted ? errors.requestedTr : undefined}
                    onChange={(requestedTr) => patch({ requestedTr })}
                  />
                </div>
              ) : null}
            </div>
          </fieldset>

          <Field label={m.plan.note} hint={m.plan.noteHint} htmlFor="plan-note" error={attempted ? errors.note : undefined}>
            <textarea
              id="plan-note"
              className={fieldClass("brand")}
              rows={3}
              maxLength={2000}
              value={form.note}
              onChange={(event) => patch({ note: event.target.value })}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{form.note.length}/2000</p>
          </Field>
        </div>

        <aside className="rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">{m.plan.preview}</h3>
          {preview ? (
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <Row k={m.plan.lotValue} v={vnd(preview.lot_value)} />
              <Row k={m.plan.cashOnHand} v={vnd(preview.cash_on_hand)} />
              <Row k={m.plan.sellWeeksRow} v={m.common.weeks(preview.sell_weeks)} />
              <Row k={m.plan.askRow} v={preview.requested_amount == null ? m.plan.askSkipped : vnd(preview.requested_amount)} />
              <div>
                <dt className="text-xs text-slate-500">{m.plan.factory}</dt>
                <dd className="mt-1 space-y-1">
                  {preview.supplier_schedule.map((row) => (
                    <div key={`${row.week}-${row.amount}`} className="flex justify-between gap-3 rounded-lg bg-white px-2 py-1.5 text-xs">
                      <span>{m.common.weekN(row.week)}</span>
                      <span className="tnum font-medium text-slate-900">{vnd(row.amount)}</span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          ) : (
            <ul className="mt-3 space-y-1 text-xs text-rose-700">
              {Object.values(errors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={busy || !ready}
            className="mt-4 w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? m.plan.calculating : m.plan.submit}
          </button>
        </aside>
      </div>
    </form>
  );
}

function validate(form: Draft, copy: Messages["plan"]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(form.lotTr) || form.lotTr <= 0) errors.lotTr = copy.lotError;
  if (!Number.isFinite(form.cashTr) || form.cashTr < 0) errors.cashTr = copy.cashError;
  if (!Number.isFinite(form.depositPct) || form.depositPct < 0 || form.depositPct > 100) errors.depositPct = copy.depositError;
  if (!Number.isInteger(form.sellWeeks) || form.sellWeeks < 1 || form.sellWeeks > 26) errors.sellWeeks = copy.weeksError;
  if (form.depositPct < 100 && (!Number.isInteger(form.remWeek) || form.remWeek < 1 || form.remWeek > form.sellWeeks)) {
    errors.remWeek = copy.remError;
  }
  if (form.declareAsk && (!Number.isFinite(form.requestedTr) || form.requestedTr <= 0 || form.requestedTr > 300)) {
    errors.requestedTr = copy.askError;
  }
  if (form.note.length > 2000) errors.note = copy.noteError;
  return errors;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="tnum font-medium text-slate-900">{v}</dd>
    </div>
  );
}

function SliderField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  display,
  error,
  bare = false,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  display?: string;
  error?: string;
  bare?: boolean;
  onChange: (value: number) => void;
}) {
  const shown = display ?? `${Number.isFinite(value) ? value : "—"} ${suffix}`.trim();
  const controls = (
    <>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="tnum text-sm font-semibold text-slate-900">{shown}</span>
      </div>
      <input
        aria-label={label}
        className="mt-1 w-full cursor-pointer"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={fieldClass("brand")}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
      />
    </>
  );
  if (bare) {
    return (
      <div>
        {controls}
        {error ? (
          <p className="mt-1 text-xs text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {controls}
    </Field>
  );
}
