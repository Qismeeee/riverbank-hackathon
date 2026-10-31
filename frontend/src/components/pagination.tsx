"use client";

import { useI18n } from "@/lib/i18n";
import { CASE_PAGE_SIZES } from "@/lib/pagination";

type Props = {
  offset: number;
  pageSize: number;
  count: number;
  total?: number;
  hasMore: boolean;
  loading?: boolean;
  disabled?: boolean;
  onOffsetChange: (offset: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function Pagination({ offset, pageSize, count, total, hasMore, loading = false, disabled = false, onOffsetChange, onPageSizeChange }: Props) {
  const { m } = useI18n();
  const copy = m.pagination;
  const page = Math.floor(offset / pageSize) + 1;
  const pages = total == null ? undefined : Math.max(1, Math.ceil(total / pageSize));
  const blocked = loading || disabled;
  const buttonClass = "cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label={copy.label} className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
      <div className="space-y-1" aria-live="polite" aria-atomic="true">
        <div>{loading ? m.common.loading : copy.range(count ? offset + 1 : 0, count ? offset + count : 0, total)}</div>
        <div className="tnum">{copy.page(page, pages)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          {copy.perPage}
          <select className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-800" value={pageSize} disabled={blocked} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {CASE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <button type="button" className={buttonClass} aria-label={copy.first} disabled={blocked || offset === 0} onClick={() => onOffsetChange(0)}>«</button>
        <button type="button" className={buttonClass} disabled={blocked || offset === 0} onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}>{copy.previous}</button>
        <button type="button" className={buttonClass} disabled={blocked || !hasMore} onClick={() => onOffsetChange(offset + pageSize)}>{copy.next}</button>
        {pages != null ? <button type="button" className={buttonClass} aria-label={copy.last} disabled={blocked || page >= pages} onClick={() => onOffsetChange((pages - 1) * pageSize)}>»</button> : null}
      </div>
    </nav>
  );
}
