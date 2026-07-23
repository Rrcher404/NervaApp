import { test, expect, type Page } from "@playwright/test";

/**
 * Committee evidence capture (MASTER-PLAN B3): screenshots at each step of the
 * acceptance criterion, written to journal/screens/ and attached to the
 * scorecard. Not an assertion suite — a camera. Run with:
 *   npx playwright test evidence-item1 --project=chromium
 */

const DIR = "journal/screens";
const LINK = "https://en.wikipedia.org/wiki/Information_search_process";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${DIR}/item1-${name}.png`, fullPage: true });
}

test("item 1 evidence trail", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await expect(page.getByTestId("capture-input")).toBeVisible();

  // 1. cold open — never a blank page
  await shot(page, "01-cold-open-empty-state");

  // 2. airplane mode: capture while fully offline
  await context.setOffline(true);
  await page.getByTestId("capture-input").fill(LINK);
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("stamp")).toBeVisible();
  await shot(page, "02-offline-first-catch-logged-stamp");

  await expect(page.getByTestId("still-sieving").first()).toBeVisible();
  await shot(page, "03-offline-still-sieving");

  // 3. reconnect — citation arrives with no user action
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("citation").first()).toContainText(/cited/i, {
    timeout: 25_000,
  });
  await shot(page, "04-back-online-cited");

  // 4. graceful degradation — extraction fails, catch survives
  await page.route("**/api/enrich", (r) => r.abort("failed"));
  await page.getByTestId("capture-input").fill("https://nonexistent.invalid/page");
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("catch-item")).toHaveCount(2);
  await shot(page, "05-extraction-failed-saved-anyway");

  // 5. reduced motion
  await page.unrouteAll();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByTestId("capture-input").fill("a plain thought, no motion");
  await page.getByTestId("capture-submit").click();
  await shot(page, "06-reduced-motion");
});
