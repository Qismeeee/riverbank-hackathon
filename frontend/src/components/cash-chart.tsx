"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Bar = { week: number; value: number };

export function CashChart({
  weeks,
  loan,
  stress,
  unit = "vnd",
  tone = "light",
}: {
  weeks: Bar[];
  loan?: number[] | null;
  stress?: number[] | null;
  unit?: "vnd" | "trieu";
  tone?: "light" | "dark";
}) {
  const { locale, m } = useI18n();
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  if (!weeks.length) return null;

  const width = 640;
  const height = 260;
  const padLeft = 72;
  const padRight = 16;
  const padTop = 16;
  const labelBand = 28;
  const axisY = height - labelBand;
  const values = [...weeks.map((week) => week.value), ...(loan ?? []), ...(stress ?? []), 0];
  let max = Math.max(...values);
  let min = Math.min(...values);
  const span = Math.max(1, max - min);
  max += span * 0.12;
  min -= span * 0.12;
  const y = (value: number) => padTop + ((max - value) / (max - min)) * (axisY - padTop);
  const slot = (width - padLeft - padRight) / weeks.length;
  const x = (index: number) => padLeft + slot * index + slot / 2;
  const barWidth = Math.min(28, slot * 0.55);
  const numberLocale = locale === "zh" ? "zh-CN" : locale === "en" ? "en-GB" : "vi-VN";
  const unitMark = locale === "en" ? "m" : locale === "zh" ? "百万" : "tr";
  const inMillions = unit === "trieu" || Math.max(Math.abs(min), Math.abs(max)) >= 1_000_000;
  const label = (value: number) => {
    if (value === 0) return "0";
    if (!inMillions) return value.toLocaleString(numberLocale);
    const million = unit === "trieu" ? value : value / 1_000_000;
    const rounded = Math.round(million * 10) / 10;
    return `${rounded.toLocaleString(numberLocale, { maximumFractionDigits: 1 })}${unitMark}`;
  };
  const dark = tone === "dark";
  const axis = dark ? "#94a3b8" : "#cbd5e1";
  const grid = dark ? "rgba(148,163,184,.35)" : "#e2e8f0";
  const labelFill = dark ? "#e2e8f0" : "#334155";
  const negatives = negativeTicks(weeks, stress, y);
  const ticks = axisTicks(min, max)
    .filter((tick) => {
      const at = y(tick);
      return at >= padTop && at <= axisY && negatives.every((floor) => Math.abs(at - y(floor)) >= 14);
    })
    .concat(negatives);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" role="img" aria-label={m.common.chartAria}>
      <rect x={padLeft} y={y(0)} width={width - padLeft - padRight} height={Math.max(0, Math.min(axisY, y(min)) - y(0))} fill="rgba(244,63,94,.06)" />
      {ticks.map((tick) => {
        const negative = tick < 0;
        const at = y(tick);
        const textY = negative && Math.abs(at - y(0)) < 14 ? y(0) + 18 : at + 4;
        return (
          <g key={tick}>
            <line x1={padLeft} x2={width - padRight} y1={at} y2={at} stroke={tick === 0 ? "#94a3b8" : negative ? "#fecdd3" : grid} />
            <text x={padLeft - 8} y={textY} textAnchor="end" fontSize={dark ? 13 : 11} fontWeight="600" fill={negative ? (dark ? "#fb7185" : "#e11d48") : labelFill}>
              {label(tick)}
            </text>
          </g>
        );
      })}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={axisY} stroke={axis} />
      <line x1={padLeft} x2={width - padRight} y1={axisY} y2={axisY} stroke={axis} />
      {weeks.map((week, index) => {
        const negative = week.value < 0;
        const top = negative ? y(0) : y(week.value);
        const barHeight = Math.max(1, Math.abs(y(week.value) - y(0)));
        return (
          <g key={week.week}>
            <rect
              className={reduced ? undefined : negative ? "bar-grow-down" : "bar-grow"}
              x={x(index) - barWidth / 2}
              y={top}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={negative ? "#f43f5e" : "#14b8a6"}
              opacity={negative ? 1 : 0.55}
            >
              <title>{`${m.common.weekN(week.week)}: ${label(week.value)}`}</title>
            </rect>
            <line x1={x(index)} x2={x(index)} y1={axisY} y2={axisY + 5} stroke="#94a3b8" />
            <text x={x(index)} y={axisY + 18} textAnchor="middle" fontSize={dark ? 13 : 12} fontWeight="600" fill={labelFill}>
              {m.common.weekMark}{week.week}
            </text>
          </g>
        );
      })}
      {stress && stress.length === weeks.length ? (
        <path
          d={stress.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ")}
          fill="none"
          stroke="#f59e0b"
          strokeDasharray="4 4"
          strokeWidth="2"
        />
      ) : null}
      {loan && loan.length === weeks.length ? (
        <path
          d={loan.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ")}
          fill="none"
          stroke="#ea580c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function negativeTicks(weeks: Bar[], stress: number[] | null | undefined, y: (value: number) => number): number[] {
  const points = [...weeks.map((week) => week.value), ...(stress ?? [])].filter((value) => value < 0);
  const kept: number[] = [];
  for (const value of [...points].sort((a, b) => a - b)) {
    const far = kept.every((tick) => Math.abs(y(value) - y(tick)) >= 16) && Math.abs(y(value) - y(0)) >= 16;
    if (!kept.length || far) kept.push(value);
  }
  return kept;
}

function axisTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const rough = span / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / pow;
  const nice = fraction >= 7.5 ? 10 : fraction >= 3.5 ? 5 : fraction >= 1.5 ? 2 : 1;
  const step = nice * pow;
  const start = Math.ceil(min / step - 1e-9) * step;
  const count = Math.max(0, Math.floor((max - start) / step + 1e-9));
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    const value = start + i * step;
    ticks.push(Math.abs(value) < step * 1e-6 ? 0 : value);
  }
  return ticks;
}

export function loanSeries(weeks: { week: number; bal_end: number }[], amount: number, deductions: number[]): number[] {
  let paid = 0;
  return weeks.map((week) => {
    if (week.week > 0 && week.week <= deductions.length) paid += deductions[week.week - 1] ?? 0;
    return week.bal_end + amount - paid;
  });
}
