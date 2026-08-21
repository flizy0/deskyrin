import { expect, test } from "@playwright/test";

test("renders every required section from canonical data", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("#overall-status")).toHaveText(/complete|partial/);
  await expect(page.locator("#updated-at")).not.toHaveText("Fetching data…");
  for (const title of ["Alerts / notable changes", "Network Performance", "Validator Status", "Economic Indicators", "Ecosystem Growth", "Data Sources"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.locator("canvas")).toHaveCount(10);
  await expect(page.locator(".validator-table tbody tr")).toHaveCount(await page.evaluate(async () => (await (await fetch("/data.json")).json()).validators.counts.total));
  await expect(page.locator("#load-error")).toBeHidden();
  expect(errors).toEqual([]);
});

test("charts accept hover and tables remain contained", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("#economics canvas").first();
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

  await expect(page.locator(".validator-table")).toBeVisible();
  const rankSort = page.getByRole("button", { name: "Rank" });
  await rankSort.click();
  await rankSort.click();
  const validatorCount = await page.evaluate(async () => (await (await fetch("/data.json")).json()).validators.counts.total);
  await expect(page.locator(".validator-table tbody tr").first().locator("td").first()).toHaveText(String(validatorCount));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
