"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_CASE_PAGE_SIZE, loadCasePage, loadDecidedPage, type CasePage } from "./pagination";
import type { QueueQuery } from "./types";

export function useCaseList(token: string | undefined, source: "seller" | "queue", initialFilter?: QueueQuery["status"]) {
  const [query, setQuery] = useState({ offset: 0, pageSize: DEFAULT_CASE_PAGE_SIZE, filter: initialFilter, revision: 0 });
  const key = JSON.stringify([token, source, query]);
  const [result, setResult] = useState<{ key: string; data?: CasePage; error?: unknown }>();

  useEffect(() => {
    if (!token) return;
    let active = true;
    const request = source === "seller"
      ? loadCasePage((page) => api.myCases(token, page), query.pageSize, query.offset)
      : query.filter === "DECIDED"
        ? loadDecidedPage((page) => api.queue(token, page), query.pageSize, query.offset)
        : loadCasePage((page) => api.queue(token, { ...page, status: query.filter }), query.pageSize, query.offset);
    request.then(
      (data) => {
        if (!active) return;
        // A concurrent decision/deletion may empty the last page; return to a valid page.
        if (data.items.length === 0 && query.offset > 0) {
          const offset = data.total != null && data.total > 0
            ? Math.min(query.offset - query.pageSize, Math.floor((data.total - 1) / query.pageSize) * query.pageSize)
            : 0;
          setQuery((current) => ({ ...current, offset }));
        } else setResult({ key, data });
      },
      (error: unknown) => { if (active) setResult({ key, error }); },
    );
    return () => { active = false; };
  }, [token, source, query, key]);

  const current = result?.key === key ? result : undefined;
  return {
    ...query,
    items: current?.data?.items ?? [],
    total: current?.data?.total,
    counts: current?.data?.counts,
    hasMore: current?.data?.hasMore ?? false,
    loading: Boolean(token) && !current,
    error: current?.error,
    setOffset: (offset: number) => setQuery((current) => ({ ...current, offset })),
    setPageSize: (pageSize: number) => setQuery((current) => ({ ...current, pageSize, offset: 0 })),
    setFilter: (filter: QueueQuery["status"]) => setQuery((current) => ({ ...current, filter, offset: 0 })),
    refresh: (firstPage = false) => setQuery((current) => ({ ...current, offset: firstPage ? 0 : current.offset, revision: current.revision + 1 })),
  };
}
