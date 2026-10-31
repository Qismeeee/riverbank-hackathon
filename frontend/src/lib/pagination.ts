import { newestFirst } from "./format";
import type { CaseListQuery, CaseStatus, CaseSummary, QueueQuery, QueueResponse } from "./types";

export const CASE_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_CASE_PAGE_SIZE = 25;

export type CasePage = {
  items: CaseSummary[];
  hasMore: boolean;
  total?: number;
  counts?: QueueResponse["counts_by_status"];
};

export function caseListQuery({ limit = DEFAULT_CASE_PAGE_SIZE, offset = 0, status }: QueueQuery = {}): string {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) query.set("status", status);
  return query.toString();
}

// One lookahead row keeps Next accurate even on the legacy response without total/has_more.
export async function loadCasePage(
  fetchPage: (query: CaseListQuery) => Promise<QueueResponse>,
  pageSize: number,
  offset: number,
): Promise<CasePage> {
  const data = await fetchPage({ limit: pageSize + 1, offset });
  return {
    items: data.items.slice(0, pageSize),
    hasMore: data.items.length > pageSize || data.has_more === true || (data.total != null && offset + pageSize < data.total),
    total: data.total,
    counts: data.counts_by_status,
  };
}

export async function loadDecidedPage(
  fetchPage: (query: QueueQuery) => Promise<QueueResponse>,
  pageSize: number,
  offset: number,
): Promise<CasePage> {
  try {
    return await loadCasePage((query) => fetchPage({ ...query, status: "DECIDED" }), pageSize, offset);
  } catch (error) {
    // The old FastAPI enum rejects the virtual DECIDED filter. Other errors must stay visible.
    if (!error || typeof error !== "object" || !("status" in error) || error.status !== 422) throw error;
  }

  // Read each sorted stream from zero: applying the merged offset to both streams skips cases.
  // This compatibility path can be removed once the backend supports status=DECIDED.
  const needed = offset + pageSize + 1;
  async function prefix(status: CaseStatus) {
    const items: CaseSummary[] = [];
    let total: number | undefined;
    let counts: QueueResponse["counts_by_status"];
    while (items.length < needed) {
      const limit = Math.min(100, needed - items.length);
      const data = await fetchPage({ status, limit, offset: items.length });
      total = data.total ?? total;
      counts = data.counts_by_status ?? counts;
      items.push(...data.items);
      if (data.items.length < limit || data.has_more === false || (total != null && items.length >= total)) break;
    }
    return { items, total, counts };
  }

  const [accepted, rejected] = await Promise.all([prefix("ACCEPTED"), prefix("REJECTED")]);
  const merged = newestFirst([...accepted.items, ...rejected.items]);
  return {
    items: merged.slice(offset, offset + pageSize),
    hasMore: merged.length > offset + pageSize,
    total: accepted.total != null && rejected.total != null ? accepted.total + rejected.total : undefined,
    counts: accepted.counts ?? rejected.counts,
  };
}
