"use client";

import { useMemo, useState } from "react";
import { CircleCheck } from "lucide-react";
import { CashChart } from "@/components/cash-chart";
import { useI18n } from "@/lib/i18n";
import { illustrate, type Sketch } from "@/lib/illustrative";

const PRESETS: Record<string, Sketch> = {
  B: { lot: 200, cash: 120, dep: 1, rem: 4, weeks: 6, payout: 70 },
  A: { lot: 200, cash: 120, dep: 0.5, rem: 4, weeks: 6, payout: 70 },
};

export function Simulator() {
  const { locale, m } = useI18n();
  const [plan, setPlan] = useState<Sketch>(PRESETS.B);
  const result = useMemo(() => illustrate(plan), [plan]);
  const million = (value: number) => m.common.million((Math.round(value * 10) / 10).toLocaleString(locale === "zh" ? "zh-CN" : locale === "en" ? "en-GB" : "vi-VN"));

  function set<K extends keyof Sketch>(key: K, value: Sketch[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <form className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/70 p-7 lg:col-span-4" onSubmit={(event) => event.preventDefault()}>
        <Slider label={m.home.lot} value={plan.lot} min={50} max={500} step={10} display={million(plan.lot)} onChange={(value) => set("lot", value)} />
        <Slider label={m.home.cash} value={plan.cash} min={0} max={300} step={10} display={million(plan.cash)} onChange={(value) => set("cash", value)} />
        <Slider label={m.home.deposit} value={Math.round(plan.dep * 100)} min={0} max={100} step={10} display={`${Math.round(plan.dep * 100)}%`} onChange={(value) => set("dep", value / 100)} />
        {plan.dep < 1 ? (
          <Slider label={m.home.remainder} value={plan.rem} min={1} max={plan.weeks} step={1} display={m.common.weekN(plan.rem)} onChange={(value) => set("rem", value)} />
        ) : null}
        <Slider label={m.home.sellOut} value={plan.weeks} min={3} max={12} step={1} display={m.common.weeks(plan.weeks)} onChange={(value) => set("weeks", value)} />
        <Slider label={m.home.payout} value={plan.payout} min={20} max={150} step={5} display={million(plan.payout)} onChange={(value) => set("payout", value)} />
        <p className="text-base leading-relaxed text-slate-300">{m.home.simNote}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cursor-pointer rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-base font-medium text-rose-100" onClick={() => setPlan(PRESETS.B)}>
            {m.home.payNow}
          </button>
          <button type="button" className="cursor-pointer rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-base font-medium text-emerald-100" onClick={() => setPlan(PRESETS.A)}>
            {m.home.negotiate}
          </button>
        </div>
      </form>
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-7 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-base font-medium">
          <span className="text-slate-100">{m.home.pocket}</span>
          <span className="flex gap-4">
            <span className="text-rose-300">{m.home.negative}</span>
            <span className="text-teal-300">{m.home.positive}</span>
            {result.gap ? <span className="text-brand-300">{m.home.ifBorrow}</span> : null}
          </span>
        </div>
        <CashChart
          tone="dark"
          unit="trieu"
          weeks={result.base.map((value, week) => ({ week, value }))}
          loan={result.withLoan}
          stress={null}
        />
        {result.gap === 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-xl font-semibold text-emerald-300">
              <CircleCheck className="h-6 w-6" />
              {m.home.noLoan}
            </div>
            <p className="mt-2 text-lg leading-relaxed text-slate-200">{m.home.noNegative(million(result.threshold))}</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label={m.home.deepest} value={million(result.gap)} tone="text-rose-200" />
            <Metric label={m.home.sampleProposal} value={million(result.amount)} tone="text-white" />
            <Metric label={m.home.repayIn} value={m.common.weeks(result.term)} tone="text-white" hint={m.home.autoDeduct(million(result.weekly))} />
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-base">
        <span className="text-slate-200">{label}</span>
        <b className="tnum text-lg font-bold text-brand-200">{display}</b>
      </div>
      <input className="mt-2 w-full" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-medium text-slate-300">{label}</div>
      <div className={`tnum mt-1 text-3xl font-bold tracking-tight ${tone}`}>{value}</div>
      {hint ? <div className="mt-2 text-sm leading-relaxed text-slate-300">{hint}</div> : null}
    </div>
  );
}
