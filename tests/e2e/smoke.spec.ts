import { test, expect } from "@playwright/test";

/**
 * Session-zero smoke: the harness itself works.
 * Item specs live alongside this file, one per build-order item:
 *   item1-capture.spec.ts, item2-voice.spec.ts, ...
 */
test("app boots and renders without a blank page", async ({ page }) => {
  await page.goto("/");
  // DESIGN-PRINCIPLES §7.2: never render a blank page.
  const text = await page.locator("body").innerText();
  expect(text.trim().length).toBeGreaterThan(0);
});
