import { expect, test, type Page, type Route } from "@playwright/test";
import type { CaseStatus, CaseSummary } from "../src/lib/types";

function fixture(count: number, status: CaseStatus = "PENDING_REVIEW", start = 0): CaseSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    case_id: `case-${String(start + index).padStart(5, "0")}`,
    seller_id: `synthetic-seller-${start + index}`,
    shop_id: "synthetic-shop",
    status, reason: null, version: 1,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, start + index)).toISOString(),
  }));
}

async function session(page: Page, role: "seller" | "underwriter" = "underwriter") {
  await page.addInitScript((role) => {
    localStorage.setItem("riverbank-locale", "en");
    if (!sessionStorage.getItem("riverbank-session")) sessionStorage.setItem("riverbank-session", JSON.stringify({
      subject: "synthetic-seller", role, access_token: "synthetic-token", token_type: "bearer", expires_at: "2099-01-01T00:00:00Z",
    }));
  }, role);
}

async function listResponse(route: Route, source: CaseSummary[], metadata = false) {
  const url = new URL(route.request().url());
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const status = url.searchParams.get("status");
  const filtered = source.filter((item) => !status || (status === "DECIDED" ? ["ACCEPTED", "REJECTED"].includes(item.status) : item.status === status));
  const counts = Object.fromEntries(["PENDING_REVIEW", "ESCALATED", "AWAITING_STATEMENT", "NO_LOAN_NEEDED", "ACCEPTED", "REJECTED"].map((status) => [status, source.filter((item) => item.status === status).length]));
  await route.fulfill({ json: {
    items: filtered.slice(offset, offset + limit), limit, offset,
    ...(metadata ? { total: filtered.length, has_more: offset + limit < filtered.length, counts_by_status: counts } : {}),
  } });
}

const pager = (page: Page) => page.getByRole("navigation", { name: "Case pagination" });
const lenderRows = (page: Page) => page.locator('main ul a[href^="/lender/"]');

test("Lender filters the full dataset and reaches the last page with backend metadata", async ({ page }) => {
  await session(page);
  const source = [...fixture(125, "ESCALATED"), ...fixture(5, "PENDING_REVIEW", 125)];
  const requests: URL[] = [];
  await page.route("**/v1/**", async (route) => {
    requests.push(new URL(route.request().url()));
    await listResponse(route, source, true);
  });
  await page.goto("/lender");
  await expect(lenderRows(page)).toHaveCount(5);
  await expect(lenderRows(page).first()).toHaveAttribute("href", "/lender/case-00125");
  expect(requests[0].searchParams.get("status")).toBe("PENDING_REVIEW");
  await page.getByRole("button", { name: "All 130", exact: true }).click();
  await expect(lenderRows(page)).toHaveCount(25);
  await pager(page).getByRole("button", { name: "Last page" }).click();
  await expect(pager(page)).toContainText("Page 6 / 6");
  await expect(lenderRows(page)).toHaveCount(5);
  await expect(pager(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  expect(requests.some((url) => url.searchParams.get("offset") === "125")).toBeTruthy();
  await pager(page).getByRole("combobox").selectOption("10");
  await expect(pager(page)).toContainText("Page 1 / 13");
  await expect(lenderRows(page)).toHaveCount(10);
  await page.getByRole("button", { name: /^Needs a statement/ }).click();
  await expect(page.getByText("No cases in this filter.", { exact: true })).toBeVisible();
  await expect(pager(page)).toContainText("Page 1 / 1");
});

test("legacy Lender pages past case 100 without fake totals or an extra empty page", async ({ page }) => {
  await session(page);
  await page.route("**/v1/**", (route) => listResponse(route, fixture(125)));
  await page.goto("/lender");
  await expect(lenderRows(page)).toHaveCount(25);
  await expect(pager(page).getByRole("button", { name: "Last page" })).toHaveCount(0);
  for (let current = 2; current <= 5; current++) {
    await pager(page).getByRole("button", { name: "Next", exact: true }).click();
    await expect(pager(page)).toContainText(`Page ${current}`);
    await expect(lenderRows(page)).toHaveCount(25);
  }
  await expect(lenderRows(page).first()).toHaveAttribute("href", "/lender/case-00100");
  await expect(pager(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await pager(page).getByRole("button", { name: "Previous", exact: true }).click();
  await expect(lenderRows(page).first()).toHaveAttribute("href", "/lender/case-00075");
});

test("late responses cannot overwrite a newly selected Lender filter", async ({ page }) => {
  await session(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let waiting = 0;
  await page.route("**/v1/**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("status") === "PENDING_REVIEW") {
      waiting++;
      await gate;
      await listResponse(route, fixture(3));
    } else await listResponse(route, fixture(2, "ESCALATED", 500));
  });
  await page.goto("/lender");
  await expect.poll(() => waiting).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Needs a person", exact: true }).click();
  await expect(lenderRows(page)).toHaveCount(2);
  const lateResponse = page.waitForResponse((response) => response.url().includes("status=PENDING_REVIEW"));
  release();
  await lateResponse;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(lenderRows(page)).toHaveCount(2);
  await expect(lenderRows(page).first()).toHaveAttribute("href", "/lender/case-00500");
});

test("a page error has Retry and never pretends to be an empty queue", async ({ page }) => {
  await session(page);
  let fail = true;
  await page.route("**/v1/**", async (route) => {
    if (fail && new URL(route.request().url()).searchParams.get("offset") === "25") {
      await route.fulfill({ status: 503, json: { detail: "Synthetic unavailable" } });
    } else await listResponse(route, fixture(51));
  });
  await page.goto("/lender");
  await expect(lenderRows(page)).toHaveCount(25);
  await pager(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic unavailable");
  await expect(page.getByText("No cases in this filter.", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(lenderRows(page)).toHaveCount(25);
  await expect(lenderRows(page).first()).toHaveAttribute("href", "/lender/case-00025");
});

test("legacy Reviewed merges accepted and rejected beyond 100 per stream", async ({ page }) => {
  await session(page);
  const source = fixture(265).map((item, index) => ({ ...item, status: index % 2 ? "REJECTED" : "ACCEPTED" })).reverse();
  await page.route("**/v1/**", async (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    if (status === "DECIDED") await route.fulfill({ status: 422, json: { detail: [] } });
    else await listResponse(route, source);
  });
  await page.goto("/lender");
  await expect(page.getByText("No cases in this filter.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(lenderRows(page)).toHaveCount(25);
  await pager(page).getByRole("combobox").selectOption("50");
  await expect(lenderRows(page)).toHaveCount(50);
  for (let current = 2; current <= 5; current++) {
    await pager(page).getByRole("button", { name: "Next", exact: true }).click();
    await expect(pager(page)).toContainText(`Page ${current}`);
    await expect(lenderRows(page)).toHaveCount(50);
  }
  const ids = await lenderRows(page).evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(ids).toEqual(source.slice(200, 250).map((item) => `/lender/${item.case_id}`));
});

test("Lender returns to a valid page if concurrent changes empty the next page", async ({ page }) => {
  await session(page);
  let source = fixture(51);
  const offsets: number[] = [];
  await page.route("**/v1/**", async (route) => {
    offsets.push(Number(new URL(route.request().url()).searchParams.get("offset")));
    await listResponse(route, source, true);
  });
  await page.goto("/lender");
  await expect(lenderRows(page)).toHaveCount(25);
  await pager(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager(page)).toContainText("Page 2 / 3");
  await expect(lenderRows(page)).toHaveCount(25);
  source = fixture(50);
  await pager(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager(page)).toContainText("Page 2 / 2");
  await expect(lenderRows(page)).toHaveCount(25);
  await expect(pager(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  expect(offsets.slice(-2)).toEqual([50, 25]);
});

test("Seller pages past 100, preserves selected detail, and resets after creating a case", async ({ page }) => {
  await session(page, "seller");
  const source = fixture(125).map((item) => ({ ...item, seller_id: "synthetic-seller" })).reverse();
  const requests: number[] = [];
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/me/cases") {
      requests.push(Number(url.searchParams.get("offset")));
      await listResponse(route, source);
    } else if (url.pathname === "/v1/cases" && route.request().method() === "POST") {
      const created = { ...fixture(1, "NO_LOAN_NEEDED", 900)[0], seller_id: "synthetic-seller" };
      source.unshift(created);
      await route.fulfill({ status: 201, json: created });
    } else {
      const selected = source.find((item) => url.pathname.includes(item.case_id));
      await route.fulfill({ json: { ...selected, explanation: [], decision: null } });
    }
  });
  await page.goto("/seller");
  const aside = page.getByRole("complementary", { name: "My cases" });
  await expect(aside.locator("li")).toHaveCount(25);
  await aside.locator("li button").first().click();
  await expect(page.locator('main section').getByText("CASE-00124", { exact: true })).toBeVisible();
  for (let current = 2; current <= 5; current++) {
    await pager(page).getByRole("button", { name: "Next", exact: true }).click();
    await expect(pager(page)).toContainText(`Page ${current}`);
    await expect(aside.locator("li")).toHaveCount(25);
  }
  expect(requests).toContain(100);
  await expect(page.locator('main section').getByText("CASE-00124", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit case", exact: true }).click();
  await expect(pager(page)).toContainText("Page 1");
  await expect(aside.locator("li").first()).toContainText("CASE-00900");
});

test("Studio filters all eval cases before pagination and resets its page", async ({ page }) => {
  await session(page);
  const cases = fixture(125).map((item, index) => ({ ...item, passed: index % 2 === 0, expected_status: null, mismatched_keys: [], gap: null, amount_proposed: null, cic_called: false, pd_scored: false }));
  await page.route("**/v1/**", async (route) => {
    if (route.request().url().includes("/eval-metrics")) {
      await route.fulfill({ json: { summary: { total: 125, passed: 63, failed: 62 }, cases } });
    } else await route.fulfill({ json: { policy_version: "synthetic", policy_hash: "synthetic", engine_version: "synthetic", policy_config: {}, cashflow_config: {}, rules: [], risk_model: {}, cic_gate: {} } });
  });
  await page.goto("/studio");
  await page.getByRole("tab", { name: "Evaluation", exact: true }).click();
  await expect(page.locator("main ul li")).toHaveCount(25);
  await pager(page).getByRole("button", { name: "Last page" }).click();
  await expect(pager(page)).toContainText("Page 5 / 5");
  await page.getByRole("textbox", { name: "Find a case", exact: true }).fill("case-00124");
  await expect(page.locator("main ul li")).toHaveCount(1);
  await expect(pager(page)).toContainText("Page 1 / 1");
  await page.getByRole("textbox", { name: "Find a case", exact: true }).fill("");
  await page.getByRole("group", { name: "Eval results" }).getByRole("button", { name: "Drift", exact: true }).click();
  await expect(pager(page)).toContainText("Page 1 / 3");
  await expect(pager(page)).toContainText("1–25 / 62 cases");
});

test("pagination fits mobile lender and seller layouts", async ({ page }) => {
  await session(page, "seller");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.route("**/v1/**", (route) => listResponse(route, fixture(35).reverse()));
  await page.goto("/seller");
  await expect(pager(page).getByRole("button", { name: "Next", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("seller-mobile.png"), fullPage: true });
  await page.evaluate(() => {
    const data = JSON.parse(sessionStorage.getItem("riverbank-session")!);
    sessionStorage.setItem("riverbank-session", JSON.stringify({ ...data, role: "underwriter" }));
  });
  await page.goto("/lender");
  await expect(pager(page).getByRole("button", { name: "Next", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("lender-mobile.png"), fullPage: true });
});
