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

  const views = [
    ["overview", "Overview", 1],
    ["network", "Network", 2],
    ["validators", "Validators", 1],
    ["economy", "Economy", 6],
    ["ecosystem", "Ecosystem", 2],
    ["sources", "Sources", 0]
  ];
  for (const [route, title, chartCount] of views) {
    await page.evaluate((id) => { window.location.hash = id; }, route);
    await expect(page.locator("#view-root")).toHaveAttribute("data-view", route);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator(".chart-card canvas")).toHaveCount(chartCount);
    await expect(page.locator(`.sidebar-nav [data-route-link="${route}"]`)).toHaveAttribute("aria-current", "page");
  }

  const data = await page.evaluate(async () => (await (await fetch("/data.json")).json()));
  await expect(page.locator(".source-ledger-panel tbody tr")).toHaveCount(Object.keys(data.sources).length);
  await expect(page.locator("#load-error")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
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
  await expect(keyboardStatus).toContainText("SOL price");
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
