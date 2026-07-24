import { test, expect } from "@playwright/test";

/**
 * Regression tests for rework cycle 1 — every finding Voss and Kowalczyk
 * filed against item 1. A fix without a test is a fix that comes back.
 */

test.describe("UNSKIPPABLE: the sacred write has a failure path", () => {
  test("a rejected local write is LOUD and does not destroy the user's text", async ({
    page,
  }) => {
    // First test in the file — absorbs dev-server cold-start under loaded CI
    // (30s hang once, 1.8s on retry). Triple the timeout to stop the cold-start
    // flake; the assertions below are unchanged.
    test.slow();
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
    // IPv4-mapped IPv6 — this was a LIVE bypass. The WHATWG URL parser
    // canonicalises "[::ffff:127.0.0.1]" to "[::ffff:7f00:1]" before any guard
    // sees it, so a regex against the dotted form never matched and the whole
    // ::ffff:0:0/96 range walked straight through to an internal service.
    "http://[::ffff:127.0.0.1]:4599/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[0:0:0:0:0:ffff:127.0.0.1]:4599/",
    "http://[::ffff:7f00:1]:4599/", // the canonicalised form, directly
    "http://[64:ff9b::127.0.0.1]/", // NAT64 well-known prefix
    "http://[fe80::1]/", // link-local
    "http://[fc00::1]/", // unique-local
    "http://0.0.0.0:4599/",
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

/**
 * Voss filed cross-tab duplicates as MEDIUM in round 1. The fix — a 2s content
 * dedupe — introduced an UNSKIPPABLE: it discarded deliberate repeats while
 * clearing the box and stamping success. The finding is therefore DECLINED, not
 * fixed, and this test now asserts the opposite of what it originally did.
 *
 * The severities are not symmetric. A duplicate catch is a cosmetic annoyance.
 * A dropped catch is a constitutional violation. Two tabs are two gestures.
 */
test.describe("DECLINED: cross-tab 'duplicates' are two deliberate captures", () => {
  test("the same text submitted from two tabs persists TWICE — nothing is discarded", async ({
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
    await expect(a.getByTestId("catch-item")).toHaveCount(2);
    await a.close();
    await b.close();
  });

  test("UNSKIPPABLE regression: a deliberate repeat is never swallowed", async ({
    page,
  }) => {
    // The exact repro from the halt: type "wait", submit, pause, type it again.
    await page.goto("/");
    await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
    await page.reload();
    await expect(page.getByTestId("capture-input")).toBeVisible();

    await page.getByTestId("capture-input").fill("wait");
    await page.getByTestId("capture-submit").click();
    await expect(page.getByTestId("catch-item")).toHaveCount(1);

    await page.waitForTimeout(1000);

    await page.getByTestId("capture-input").fill("wait");
    await page.getByTestId("capture-submit").click();
    await expect(page.getByTestId("catch-item")).toHaveCount(2);

    // and it is genuinely on disk, not just on screen
    await page.reload();
    await expect(page.getByTestId("catch-item")).toHaveCount(2);
  });

  test("a burst of five rapid captures all land, and the button never wedges", async ({
    page,
  }) => {
    // Hyperfocus harvest is a flagship mechanic; the removed lock stalled it.
    await page.goto("/");
    await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
    await page.reload();
    await expect(page.getByTestId("capture-input")).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await page.getByTestId("capture-input").fill(`burst thought ${i}`);
      await page.getByTestId("capture-submit").click({ timeout: 3000 });
    }
    await expect(page.getByTestId("catch-item")).toHaveCount(5);
  });
});
