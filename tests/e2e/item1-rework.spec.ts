import { test, expect } from "@playwright/test";

/**
 * Regression tests for rework cycle 1 — every finding Voss and Kowalczyk
 * filed against item 1. A fix without a test is a fix that comes back.
 */

test.describe("UNSKIPPABLE: the sacred write has a failure path", () => {
  test("a rejected local write is LOUD and does not destroy the user's text", async ({
    page,
  }) => {
    // Break IndexedDB before any app script runs. openDb() memoises its
    // promise, so a "fail on the Nth call" patch would never fire on the
    // write path — the store has to be broken outright.
    // Patch the PROTOTYPE — WebKit does not honour an own-property assignment
    // on the indexedDB instance.
    await page.addInitScript(() => {
      Object.defineProperty(IDBFactory.prototype, "open", {
        configurable: true,
        writable: true,
        value: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
      });
    });
    await page.goto("/");
    await expect(page.getByTestId("capture-input")).toBeVisible();

    const words = "the thought I cannot afford to lose";
    await page.getByTestId("capture-input").fill(words);
    await page.getByTestId("capture-submit").click();

    // loud
    await expect(page.getByTestId("save-error")).toBeVisible();
    // and the user's words are STILL in the box
    await expect(page.getByTestId("capture-input")).toHaveValue(words);
    // and no false celebration
    await expect(page.getByTestId("stamp")).toHaveCount(0);
  });
});

test.describe("HIGH: SSRF — /api/enrich refuses private addresses", () => {
  const blocked = [
    "http://127.0.0.1:4599/",
    "http://localhost:4599/",
    "http://2130706433:4599/", // decimal-encoded 127.0.0.1
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://[::1]:4599/",
  ];

  for (const url of blocked) {
    test(`refuses ${url}`, async ({ request }) => {
      const res = await request.post("/api/enrich", { data: { url } });
      const body = await res.json();
      expect(body.ok, `expected refusal for ${url}`).toBe(false);
      expect(body.title).toBeUndefined();
      expect(body.error).toMatch(/private address|could not resolve|unreachable|timed out/i);
    });
  }

  test("still allows a normal public URL", async ({ request }) => {
    const res = await request.post("/api/enrich", {
      data: { url: "https://example.com/" },
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.title).toBeTruthy();
  });
});

test.describe("HIGH: sweep race cannot revert a cited catch", () => {
  test("a failing retry never downgrades an already-cited catch or erases its title", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
    await page.reload();
    await expect(page.getByTestId("capture-input")).toBeVisible();

    await page.getByTestId("capture-input").fill("https://example.com/");
    await page.getByTestId("capture-submit").click();
    await expect(page.getByTestId("citation").first()).toContainText(/cited/i, {
      timeout: 25_000,
    });

    // Now make every subsequent enrich fail, and force sweeps to run.
    await page.route("**/api/enrich", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "forced failure" }),
      }),
    );
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForTimeout(250);
    }

    // still cited, title intact
    await expect(page.getByTestId("catch-item").first()).toHaveAttribute(
      "data-status",
      "sieved",
    );
    await expect(page.getByTestId("citation").first()).toContainText(/cited/i);
  });
});

test.describe("MEDIUM: cross-tab duplicate capture", () => {
  test("the same text submitted from two tabs at once persists once", async ({
    context,
  }) => {
    const a = await context.newPage();
    await a.goto("/");
    await a.evaluate(() => indexedDB.deleteDatabase("sieve"));
    await a.reload();
    await expect(a.getByTestId("capture-input")).toBeVisible();

    const b = await context.newPage();
    await b.goto("/");
    await expect(b.getByTestId("capture-input")).toBeVisible();

    const text = "hyperfocus, three tabs, one thought";
    await a.getByTestId("capture-input").fill(text);
    await b.getByTestId("capture-input").fill(text);
    await Promise.all([
      a.getByTestId("capture-submit").click(),
      b.getByTestId("capture-submit").click(),
    ]);

    await a.reload();
    await expect(a.getByTestId("catch-item")).toHaveCount(1);
    await a.close();
    await b.close();
  });
});
