import assert from "node:assert/strict";
import { test } from "node:test";
import { api, ApiError } from "../src/lib/api";
import { newestFirst } from "../src/lib/format";
import { caseListQuery, loadCasePage, loadDecidedPage } from "../src/lib/pagination";
import type { CaseStatus, CaseSummary, QueueQuery, QueueResponse } from "../src/lib/types";

function cases(count: number, status: CaseStatus = "PENDING_REVIEW", start = 0): CaseSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    case_id: `case-${String(start + index).padStart(5, "0")}`,
    seller_id: "synthetic-seller",
    shop_id: "synthetic-shop",
    status,
    version: 1,
    reason: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, start + index)).toISOString(),
  }));
}

function response(items: CaseSummary[], { limit = 25, offset = 0 }: QueueQuery, metadata = false): QueueResponse {
  return {
    items: items.slice(offset, offset + limit), limit, offset,
    ...(metadata ? { total: items.length, has_more: offset + limit < items.length } : {}),
  };
}

test("query carries the chosen server filter, page size and offset", () => {
  assert.equal(caseListQuery({ status: "ESCALATED", limit: 26, offset: 100 }), "limit=26&offset=100&status=ESCALATED");
  assert.equal(caseListQuery(), "limit=25&offset=0");
});

test("legacy queue exposes every one of 125 cases, preserving server order across pages", async () => {
  const source = cases(125);
  const visited: string[] = [];
  const requests: QueueQuery[] = [];
  for (let offset = 0; ; offset += 25) {
    const page = await loadCasePage(async (query) => {
      requests.push(query);
      return response(source, query);
    }, 25, offset);
    visited.push(...page.items.map((item) => item.case_id));
    assert.equal(page.total, undefined, "a page length must not become a global total");
    if (!page.hasMore) break;
  }
  assert.deepEqual(visited, source.map((item) => item.case_id));
  assert.deepEqual(requests.map((query) => query.offset), [0, 25, 50, 75, 100]);
  assert.ok(requests.every((query) => query.limit === 26));
});

test("lookahead enables Next when the only remaining row is outside the displayed page", async () => {
  const source = cases(26);
  const first = await loadCasePage(async (query) => response(source, query, true), 25, 0);
  assert.equal(first.hasMore, true, "API has_more=false for the requested 26 still leaves a displayed row");
  const last = await loadCasePage(async (query) => response(source, query, true), 25, 25);
  assert.equal(last.items.length, 1);
  assert.equal(last.hasMore, false);
  assert.equal(last.total, 26);
});

test("empty and exact-full final legacy pages have no phantom Next page", async () => {
  for (const count of [0, 25, 50]) {
    const offset = count === 50 ? 25 : 0;
    const page = await loadCasePage(async (query) => response(cases(count), query), 25, offset);
    assert.equal(page.hasMore, false);
    assert.equal(page.items.length, count === 0 ? 0 : 25);
  }
});

test("new backend metadata preserves the total and global counts", async () => {
  const counts = { PENDING_REVIEW: 125, ESCALATED: 5 };
  const page = await loadCasePage(async (query) => ({ ...response(cases(125), query, true), counts_by_status: counts }), 25, 100);
  assert.equal(page.total, 125);
  assert.deepEqual(page.counts, counts);
  assert.equal(page.hasMore, false);
});

test("updated backend serves a merged DECIDED page in one request", async () => {
  const source = newestFirst([...cases(70, "ACCEPTED"), ...cases(80, "REJECTED", 70)]);
  const requests: QueueQuery[] = [];
  const page = await loadDecidedPage(async (query) => {
    requests.push(query);
    return response(source, query, true);
  }, 25, 100);
  assert.deepEqual(requests, [{ status: "DECIDED", limit: 26, offset: 100 }]);
  assert.deepEqual(page.items, source.slice(100, 125));
  assert.equal(page.total, 150);
  assert.equal(page.hasMore, true);
});

test("legacy DECIDED merges complete prefixes, including offsets beyond the API limit", async () => {
  const source = cases(265).map((item, index) => ({ ...item, status: index % 2 ? "REJECTED" : "ACCEPTED" }));
  // Also exercise a deterministic case_id tie-breaker across the two source streams.
  source[130].created_at = source[131].created_at;
  const sorted = newestFirst(source);
  const requests: QueueQuery[] = [];
  const visited: CaseSummary[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await loadDecidedPage(async (query) => {
      requests.push(query);
      if (query.status === "DECIDED") throw new ApiError(422, {});
      return response(sorted.filter((item) => item.status === query.status), query);
    }, 50, offset);
    visited.push(...page.items);
    if (!page.hasMore) break;
  }
  assert.deepEqual(visited, sorted);
  assert.equal(new Set(visited.map((item) => item.case_id)).size, 265);
  assert.ok(requests.every((query) => (query.limit ?? 0) <= 100));
  assert.ok(requests.some((query) => query.offset === 100));
});

test("legacy DECIDED handles an empty stream and sums totals only when both are supplied", async () => {
  const accepted = newestFirst(cases(27, "ACCEPTED"));
  const page = await loadDecidedPage(async (query) => {
    if (query.status === "DECIDED") throw new ApiError(422, {});
    return response(query.status === "ACCEPTED" ? accepted : [], query, true);
  }, 25, 25);
  assert.deepEqual(page.items, accepted.slice(25));
  assert.equal(page.hasMore, false);
  assert.equal(page.total, 27);
});

test("DECIDED propagates auth/server failures without trying a legacy fallback", async () => {
  for (const status of [401, 403, 500, 503]) {
    const error = new ApiError(status, {});
    let calls = 0;
    await assert.rejects(loadDecidedPage(async () => { calls++; throw error; }, 25, 0), (actual) => actual === error);
    assert.equal(calls, 1);
  }
});

test("legacy DECIDED rejects partial results when one stream fails", async () => {
  await assert.rejects(loadDecidedPage(async (query) => {
    if (query.status === "DECIDED") throw new ApiError(422, {});
    if (query.status === "REJECTED") throw new Error("synthetic unavailable");
    return response(cases(10, "ACCEPTED"), query);
  }, 25, 0), /synthetic unavailable/);
});

test("typed API client forwards pagination and bearer auth for lender and seller", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; auth: string | undefined }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), auth: (init?.headers as Record<string, string>).Authorization });
    return new Response(JSON.stringify({ items: [], limit: 26, offset: 100 }));
  };
  try {
    await api.queue("synthetic-token", { status: "AWAITING_STATEMENT", limit: 26, offset: 100 });
    await api.myCases("synthetic-token", { limit: 26, offset: 100 });
    assert.ok(requests[0].url.endsWith("/v1/queue?limit=26&offset=100&status=AWAITING_STATEMENT"));
    assert.ok(requests[1].url.endsWith("/v1/me/cases?limit=26&offset=100"));
    assert.ok(requests.every((request) => request.auth === "Bearer synthetic-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
