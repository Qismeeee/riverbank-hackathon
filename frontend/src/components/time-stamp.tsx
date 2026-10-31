"use client";

import { age, clock } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function TimeStamp({
  iso,
  label,
  tone = "light",
}: {
  iso: string;
  label?: string;
  tone?: "light" | "dark";
}) {
  const { locale, m } = useI18n();
  const muted = tone === "dark" ? "text-slate-400" : "text-slate-500";
  const strong = tone === "dark" ? "text-slate-100" : "text-slate-800";
  return (
    <p className={`text-xs ${muted}`}>
      {label ? <span>{label} </span> : null}
      <time dateTime={iso} className={`tnum font-medium ${strong}`}>
        {clock(iso, locale)}
      </time>
      <span> · {age(iso, { minutes: m.common.agoMinutes, hours: m.common.agoHours, days: m.common.agoDays })}</span>
    </p>
  );
}
