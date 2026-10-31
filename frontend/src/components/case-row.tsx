"use client";

import Link from "next/link";
import { StatusBadge, statusChrome } from "@/components/status-badge";
import { TimeStamp } from "@/components/time-stamp";
import { caseCode } from "@/lib/format";
import type { CaseSummary } from "@/lib/types";

export function CaseRow({
  item,
  active,
  tone,
  href,
  onSelect,
}: {
  item: CaseSummary;
  active?: boolean;
  tone: "brand" | "teal";
  href?: string;
  onSelect?: () => void;
}) {
  const idle =
    tone === "brand"
      ? "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/80 hover:shadow-sm"
      : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/70 hover:shadow-sm";
  const selected =
    tone === "brand" ? "border-brand-400 bg-brand-50 shadow-sm" : "border-teal-500 bg-teal-50 shadow-sm";
  const className = `group relative block w-full cursor-pointer overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors duration-200 ${active ? selected : idle}`;
  const body = (
    <>
      <span aria-hidden className={`absolute inset-y-2 left-1.5 w-1 rounded-full ${statusChrome(item.status).rail}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          {tone === "teal" ? <div className="truncate text-sm font-medium text-slate-900">{item.seller_id}</div> : null}
          <div className="mono text-xs font-medium text-slate-700">{caseCode(item.case_id)}</div>
          <div className="mt-1">
            <TimeStamp iso={item.created_at} />
          </div>
        </div>
        <StatusBadge status={item.status} reason={item.reason} />
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? "page" : undefined}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={className} aria-current={active ? "true" : undefined} onClick={onSelect}>
      {body}
    </button>
  );
}
