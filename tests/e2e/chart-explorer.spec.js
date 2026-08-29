import { expect, test } from "@playwright/test";

const DAY_MS = 86_400_000;

async function loadRoute(page, route) {
  await page.goto(`/#${route}`);
  await expect(page.locator("#overall-status")).toHaveText(/complete|partial/);
  await expect(page.locator("#view-root")).toHaveAttribute("data-view", route);
}

async function explorerWindow(page) {
  return page.locator("[data-chart-explorer-window]").evaluate((node) => ({
    end: Date.parse(node.dataset.end),
    points: Number(node.dataset.points),
    start: Date.parse(node.dataset.start)
  }));
}

test("network charts open one lazy native explorer with canonical source rows", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await loadRoute(page, "network");

  await expect(page.locator("[data-chart-explorer-open]")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Explore TPS history", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Explore Slot-time history", exact: true })).toHaveCount(1);
  await expect(page.locator("[data-chart-explorer-dialog]")).toHaveCount(0);

  const data = await page.evaluate(async () => (await (await fetch("/data.json")).json()));
  await page.getByRole("button", { name: "Explore TPS history", exact: true }).click();
  const dialog = page.locator("[data-chart-explorer-dialog]");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.open && node.matches(":modal"))).toBe(true);
  await expect(dialog.getByRole("heading", { name: "TPS history" })).toBeVisible();
  await expect(page.locator(".chart-card canvas")).toHaveCount(2);
  await expect(page.locator("[data-chart-explorer-canvas]")).toHaveCount(1);

  const table = page.locator("[data-chart-explorer-table]");
  await expect(table.locator("thead th")).toHaveText(["UTC time", "Total TPS", "Non-vote TPS"]);
  const rows = table.locator("tbody tr");
  const history = data.network.performance.history;
  await expect(rows).toHaveCount(history.length);
  for (const [rowIndex, point] of [[0, history[0]], [history.length - 1, history.at(-1)]]) {
    const row = rows.nth(rowIndex);
    await expect(row).toHaveAttribute("data-timestamp", point.observedAt);
    await expect(row.locator("time")).toHaveAttribute("datetime", point.observedAt);
    await expect(row.locator("td").nth(1)).toHaveAttribute("data-value", String(point.totalTps));
    await expect(row.locator("td").nth(2)).toHaveAttribute("data-value", String(point.nonVoteTps));
  }
  expect(errors).toEqual([]);
});

test("range presets, wheel, pan, drag, and reset stay inside visible SOL source history", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Pointer precision is covered in the desktop project");
  await loadRoute(page, "economy");
  await page.getByRole("button", { name: "Explore SOL price · source comparison", exact: true }).click();
  const fullRange = await explorerWindow(page);
  const first = fullRange.start;
  const last = fullRange.end;
  const tableRows = page.locator("[data-chart-explorer-table] tbody tr");
  await expect(page.locator("[data-chart-explorer-table] thead")).not.toContainText("Published headline");

  for (const [name, duration] of [["24H", DAY_MS], ["7D", 7 * DAY_MS], ["30D", 30 * DAY_MS]]) {
    await page.getByRole("button", { name, exact: true }).click();
    const expectedStart = Math.max(first, last - duration);
    await expect.poll(async () => {
      const range = await explorerWindow(page);
      return { start: range.start, end: range.end };
    }).toEqual({ start: expectedStart, end: last });
    expect((await explorerWindow(page)).points).toBe(await tableRows.count());
  }

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect.poll(async () => explorerWindow(page)).toEqual(fullRange);

  const canvas = page.locator("[data-chart-explorer-canvas]");
  await canvas.hover();
  const fullSpan = last - first;
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => {
    const range = await explorerWindow(page);
    return range.end - range.start;
  }).toBeLessThan(fullSpan);

  const zoomedSpan = (await explorerWindow(page)).end - (await explorerWindow(page)).start;
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(async () => {
    const range = await explorerWindow(page);
    return range.end - range.start;
  }).toBeGreaterThan(zoomedSpan);

  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const beforePan = await explorerWindow(page);
  await page.getByRole("button", { name: "Pan left", exact: true }).click();
  await expect.poll(async () => (await explorerWindow(page)).start).toBeLessThan(beforePan.start);

  const beforeDrag = await explorerWindow(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await explorerWindow(page)).start).not.toBe(beforeDrag.start);

  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(async () => explorerWindow(page)).toEqual(fullRange);
});

test("Escape restores focus and repeat opens do not leak chart canvases", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await loadRoute(page, "network");
  const opener = page.getByRole("button", { name: "Explore Slot-time history", exact: true });

  await opener.focus();
  await opener.click();
  await expect(page.getByRole("button", { name: "Close chart explorer" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-chart-explorer-dialog]")).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(page.locator("[data-chart-explorer-canvas]")).toHaveCount(0);

  for (let iteration = 0; iteration < 2; iteration += 1) {
    await opener.click();
    await expect(page.locator("[data-chart-explorer-dialog]")).toHaveCount(1);
    await expect(page.locator("[data-chart-explorer-canvas]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close chart explorer" }).click();
    await expect(page.locator("[data-chart-explorer-canvas]")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("mobile explorer supports pinch, horizontal pan, and contained layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Touch gestures are covered in the mobile project");
  await loadRoute(page, "economy");
  await page.getByRole("button", { name: "Explore SOL price · source comparison", exact: true }).click();
  const dialog = page.locator("[data-chart-explorer-dialog]");
  const canvas = page.locator("[data-chart-explorer-canvas]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);

  const beforePinch = await explorerWindow(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
    { x: centerX - 35, y: centerY }, { x: centerX + 35, y: centerY }
  ] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
    { x: centerX - 95, y: centerY }, { x: centerX + 95, y: centerY }
  ] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => {
    const range = await explorerWindow(page);
    return range.end - range.start;
  }).toBeLessThan(beforePinch.end - beforePinch.start);

  const beforePan = await explorerWindow(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: centerX, y: centerY }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: centerX + 70, y: centerY }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await explorerWindow(page)).start).not.toBe(beforePan.start);

  const containment = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      insideViewport: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
      contained: node.scrollWidth <= node.clientWidth + 1,
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  expect(containment).toEqual({ insideViewport: true, contained: true, documentOverflow: false });
});
