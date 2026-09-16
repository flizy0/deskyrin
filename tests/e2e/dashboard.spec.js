import { expect, test } from "@playwright/test";

async function loadRoute(page, route = "overview") {
  await page.goto(`/#${route}`);
  await expect(page.locator("#overall-status")).toHaveText(/complete|partial/);
  await expect(page.locator("#view-root")).toHaveAttribute("data-view", route);
}

test("renders every terminal route lazily from the canonical snapshot", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await loadRoute(page);
  await expect(page.locator("#updated-at")).not.toHaveText("Fetching data…");
  await expect(page.getByRole("button", { name: "Refresh snapshot" })).toHaveCount(0);

  const views = [
    ["overview", "Overview", 1],
    ["network", "Network", 2],
    ["validators", "Validators", 1],
    ["economy", "Economy", 7],
    ["ecosystem", "Ecosystem", 2],
    ["sources", "Sources", 0]
  ];
  for (const [route, title, chartCount] of views) {
    await page.evaluate((id) => { window.location.hash = id; }, route);
    await expect(page.locator("#view-root")).toHaveAttribute("data-view", route);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator(".chart-card canvas")).toHaveCount(chartCount);
    await expect(page.locator(`.sidebar-nav [data-route-link="${route}"]`)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".coverage-callout")).toHaveCount(0);
  }

  const data = await page.evaluate(async () => (await (await fetch("/data.json")).json()));
  await expect(page.locator(".source-ledger-panel tbody tr")).toHaveCount(Object.keys(data.sources).length);
  await expect(page.locator("#load-error")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test("initial snapshot failures still offer Retry without a Refresh control", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requests = 0;
  await page.route("**/data.json", async (route) => {
    requests += 1;
    if (requests === 1) await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    else await route.continue();
  });
  await page.goto("/#overview");
  await expect(page.locator("#load-error")).toBeVisible();
  await expect(page.locator("#overall-status")).toHaveText("Snapshot unavailable");
  await expect(page.getByRole("button", { name: "Refresh snapshot" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("#overall-status")).toHaveText(/complete|partial/);
  await expect(page.locator("#view-root")).toHaveAttribute("data-view", "overview");
  await expect(page.locator("#load-error")).toBeHidden();
  expect(requests).toBe(2);
  expect(errors).toEqual([]);
});

test("snapshot chart ranges honor retention without cutting provider history", async ({ page }) => {
  await loadRoute(page, "network");
  const data = await page.evaluate(async () => (await (await fetch("/data.json")).json()));
  const expectedNetworkStart = data.network.performance.history[0].observedAt;
  expect(Date.parse(expectedNetworkStart)).toBeGreaterThanOrEqual(Date.parse("2026-08-29T15:10:55.812Z"));
  await page.getByRole("button", { name: "Explore TPS history", exact: true }).click();
  const networkStart = await page.locator("[data-chart-explorer-window]").getAttribute("data-start");
  expect(networkStart).toBe(expectedNetworkStart);
  await page.getByRole("button", { name: "Close chart explorer" }).click();
  await page.evaluate(() => { window.location.hash = "economy"; });
  await expect(page.locator("#view-root")).toHaveAttribute("data-view", "economy");
  await page.getByRole("button", { name: "Explore SOL price · source comparison", exact: true }).click();
  const providerStart = await page.locator("[data-chart-explorer-window]").getAttribute("data-start");
  expect(Date.parse(providerStart)).toBeLessThan(Date.parse(networkStart));
});

test("validator filters and sorting remain local and reversible", async ({ page }) => {
  await loadRoute(page, "validators");
  const data = await page.evaluate(async () => (await (await fetch("/data.json")).json()));
  await expect(page.locator(".validator-table tbody tr")).toHaveCount(data.validators.counts.total);

  const search = page.getByRole("searchbox", { name: "Search validators by vote or node key" });
  const target = data.validators.table[0];
  await search.fill(target.votePubkey.slice(0, 12));
  await expect(page.locator(".validator-table tbody tr:not([hidden])")).toHaveCount(1);
  await search.fill("");
  await page.getByRole("button", { name: "Delinquent", exact: true }).click();
  await expect(page.locator(".validator-table tbody tr:not([hidden])")).toHaveCount(data.validators.counts.delinquent);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".validator-table tbody tr:not([hidden])")).toHaveCount(data.validators.counts.total);

  const rankSort = page.getByRole("button", { name: "Rank", exact: true });
  await rankSort.click();
  await rankSort.click();
  await expect(page.locator(".validator-table tbody tr").first().locator("td").first()).toHaveText(String(data.validators.counts.total));
});

test("charts accept hover and keyboard inspection while tables stay contained", async ({ page }) => {
  await loadRoute(page, "economy");
  const canvas = page.locator(".chart-card canvas").first();
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const beforeHover = await canvas.screenshot();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => Buffer.compare(beforeHover, await canvas.screenshot())).not.toBe(0);

  await canvas.focus();
  const keyboardStatus = canvas.locator("xpath=following-sibling::*[contains(@class, 'chart-a11y-status')]");
  await expect(keyboardStatus).toContainText("UTC");
  await expect(keyboardStatus).toContainText(/Allium|Artemis|Birdeye|Blockworks|DeFiLlama|DexPaprika|Dune|Token Terminal|Coinbase|CoinGecko/);
  await expect(keyboardStatus).not.toContainText("Published headline");
  const latestStatus = await keyboardStatus.textContent();
  await canvas.press("ArrowLeft");
  expect(await keyboardStatus.textContent()).not.toBe(latestStatus);

  await page.evaluate(() => { window.location.hash = "validators"; });
  await expect(page.locator("#view-root")).toHaveAttribute("data-view", "validators");
  await expect(page.locator(".validator-table")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test("mobile navigation becomes a contained drawer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Drawer behavior is covered in the mobile project");
  await loadRoute(page);
  const open = page.getByRole("button", { name: "Open navigation" });
  await open.click();
  await expect(page.locator("#app-sidebar")).toHaveClass(/is-open/);
  await expect(page.locator("body")).toHaveClass(/navigation-is-open/);
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();

  await page.locator('[data-route-nav] [data-route-link="economy"]').click();
  await expect(page).toHaveURL(/#economy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Economy" })).toBeVisible();
  await expect(page.locator("#app-sidebar")).not.toHaveClass(/is-open/);
  await expect(open).toHaveAttribute("aria-expanded", "false");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
