import { test, expect, type Page } from "@playwright/test";

/**
 * ITEM 1 acceptance criterion (MASTER-PLAN Appendix A):
 *   ✓ = a pasted link survives airplane mode and appears cited when back online.
 *
 * Kowalczyk's battery: the happy path proves nothing. Every test here cuts
 * something.
 */

const LINK = "https://example.com/";

async function capture(page: Page, text: string) {
  await page.getByTestId("capture-input").fill(text);
  await page.getByTestId("capture-submit").click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  // Wait for hydration before any test touches the network. Without this the
  // offline tests can cut the connection while the dev server is still
  // compiling, which fails the click for reasons that have nothing to do
  // with the product.
  await expect(page.getByTestId("capture-input")).toBeVisible();
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("THE CRITERION: a pasted link survives airplane mode and is cited when back online", async ({
  page,
  context,
}) => {
  // ---- airplane mode ON, before the capture ----
  await context.setOffline(true);
  await capture(page, LINK);

  // the catch landed anyway
  const item = page.getByTestId("catch-item").first();
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute("data-type", "link");
  await expect(page.getByTestId("still-sieving").first()).toBeVisible();

  // it is on DISK, not in memory — read IndexedDB directly, still offline.
  // (A cold reload while offline needs a cached app shell; the PWA/service
  // worker is v0.5 scope per MASTER-PLAN §14. Tracked as a punch-list item.)
  const onDisk = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("sieve");
        req.onsuccess = () => {
          const all = req.result
            .transaction("catches", "readonly")
            .objectStore("catches")
            .getAll();
          all.onsuccess = () => resolve(all.result.length);
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(onDisk).toBe(1);

  // ---- back online: the citation arrives without the user doing anything ----
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(page.getByTestId("citation").first()).toContainText(/cited/i, {
    timeout: 25_000,
  });
  await expect(page.getByTestId("catch-item").first()).toHaveAttribute(
    "data-status",
    "sieved",
  );
});

test("capture costs zero decisions and three interactions", async ({ page }) => {
  // §7.3 — no title field, no folder picker, no tag input, no project select
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.locator('input[type="text"]')).toHaveCount(0);

  // open → type → submit. Three interactions to a logged catch.
  await capture(page, "a half-sentence I do not want to lose");
  await expect(page.getByTestId("stamp")).toBeVisible();
  await expect(page.getByTestId("stamp")).toContainText(/first catch logged/i);
});

test("never renders a blank page", async ({ page }) => {
  // §7.2 — the empty state is pre-seeded with instruction
  await expect(page.getByTestId("empty-state")).toBeVisible();
  const body = (await page.locator("body").innerText()).trim();
  expect(body.length).toBeGreaterThan(40);
});

test("enrichment failure does not lose the catch", async ({ page }) => {
  await page.route("**/api/enrich", (route) => route.abort("failed"));
  await capture(page, "https://this-host-does-not-resolve.invalid/x");

  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
});

test("enrichment hanging does not block or lose the catch", async ({ page }) => {
  // Voss: a hang is worse than a failure. Is there a timeout?
  await page.route("**/api/enrich", async () => {
    // never fulfils
  });
  await capture(page, "https://example.com/hang");
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  // the input is still usable while the request dangles
  await capture(page, "second thought, typed while the first still hangs");
  await expect(page.getByTestId("catch-item")).toHaveCount(2);
});

test("network cut MID-WRITE loses nothing", async ({ page, context }) => {
  await page.getByTestId("capture-input").fill(LINK);
  const submit = page.getByTestId("capture-submit").click();
  await context.setOffline(true);
  await submit;
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  // reconnect, then reload — the catch is still there, from disk
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
});

test("rapid double-submit does not duplicate a catch", async ({ page }) => {
  await page.getByTestId("capture-input").fill("only once please");
  const btn = page.getByTestId("capture-submit");
  await btn.click();
  await btn.click({ force: true }).catch(() => {});
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
});

test("hostile input is captured verbatim, not executed", async ({ page }) => {
  const hostile = '<script>window.__pwned=1</script> & "quoted" — emoji 🧠';
  await capture(page, hostile);
  await expect(page.getByTestId("catch-item").first()).toContainText("window.__pwned");
  expect(await page.evaluate(() => (window as never as Record<string, unknown>).__pwned)).toBeUndefined();
});

test("a 200KB paste is captured without dropping it", async ({ page }) => {
  const big = "x".repeat(200_000);
  await capture(page, big);
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
});

test("no gap, no guilt, no streak surface anywhere", async ({ page }) => {
  // DESIGN-PRINCIPLES §1 — banned-mechanic sweep on rendered copy
  await capture(page, "one thing");
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const banned of [
    "streak",
    "you missed",
    "days missed",
    "don't break",
    "we miss you",
    "overdue",
    "lost progress",
    "keep it up",
  ]) {
    expect(body, `banned copy found: "${banned}"`).not.toContain(banned);
  }
});

test("reduced motion: the stamp does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await capture(page, "quiet please");
  const anim = await page
    .getByTestId("stamp")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim === "none" || anim === "").toBeTruthy();
});
