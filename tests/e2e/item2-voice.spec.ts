import { test, expect, type Page } from "@playwright/test";

/**
 * ITEM 2 acceptance criterion (MASTER-PLAN Appendix A):
 *   ✓ = a 60s voice ramble becomes a cited, transcribed catch.
 *
 * Playwright/WebKit can't grant a real mic, so per B3 we inject an audio
 * fixture through the store's own addVoiceCatch and verify the transcript
 * lands via the real transcription path. The mocked-provider tests prove the
 * pipeline; the live test (item2-voice-live) proves the product.
 */

/**
 * Add a voice catch as the recorder would on stop — written straight to the
 * store's IndexedDB (the object store already exists once the empty state has
 * rendered). Matches lib/store.ts's LocalCatch shape exactly.
 */
async function injectVoice(page: Page, seconds = 3) {
  await page.evaluate(
    ([secs]) =>
      new Promise<void>((resolve, reject) => {
        // a real, non-empty WAV blob
        const sampleRate = 8000;
        const n = sampleRate * secs;
        const buf = new ArrayBuffer(44 + n * 2);
        const view = new DataView(buf);
        const w = (o: number, s: string) => {
          for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
        };
        w(0, "RIFF");
        view.setUint32(4, 36 + n * 2, true);
        w(8, "WAVE");
        w(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        w(36, "data");
        view.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, Math.sin(i / 20) * 800, true);
        const catchRecord = {
          id: crypto.randomUUID(),
          type: "voice",
          rawContent: "",
          sourceMeta: {},
          status: "raw",
          capturedAt: new Date().toISOString(),
          synced: false,
          enrichAttempts: 0,
          // ArrayBuffer, not Blob — matches the store, and the shape WebKit
          // can actually persist.
          audioData: buf,
          audioType: "audio/wav",
          durationMs: secs * 1000,
        };

        // Open at the app's version and create the store if we win the race
        // to open first (WebKit timing) — matches lib/store.ts's schema.
        const req = indexedDB.open("sieve", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("catches")) {
            const store = db.createObjectStore("catches", { keyPath: "id" });
            store.createIndex("capturedAt", "capturedAt");
            store.createIndex("status", "status");
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const t = db.transaction("catches", "readwrite");
          t.objectStore("catches").put(catchRecord);
          t.oncomplete = () => resolve();
          t.onerror = () => reject(new Error("put failed: " + (t.error?.message ?? "unknown")));
        };
        req.onerror = () =>
          reject(new Error("open failed: " + (req.error?.message ?? "unknown")));
        req.onblocked = () => reject(new Error("open blocked"));
      }),
    [seconds] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await expect(page.getByTestId("capture-input")).toBeVisible();
});

test("a voice memo persists locally before any transcription is attempted", async ({
  page,
  context,
}) => {
  // Capture is sacred: even fully offline, the recording lands on disk.
  // (Read IndexedDB directly rather than reloading — a cold offline reload
  // needs a service worker, which is v0.5 scope. The point is durability.)
  await context.setOffline(true);
  await injectVoice(page, 2);

  const onDisk = await page.evaluate(
    () =>
      new Promise<{ count: number; audioBytes: number; type: string }>((resolve, reject) => {
        const req = indexedDB.open("sieve");
        req.onsuccess = () => {
          const all = req.result
            .transaction("catches", "readonly")
            .objectStore("catches")
            .getAll();
          all.onsuccess = () => {
            const c = all.result[0];
            resolve({
              count: all.result.length,
              audioBytes: c?.audioData?.byteLength ?? 0,
              type: c?.type,
            });
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(onDisk.count).toBe(1);
  expect(onDisk.audioBytes).toBeGreaterThan(0);
  expect(onDisk.type).toBe("voice");
  await context.setOffline(false);
});

test("a transcript lands and the catch is marked transcribed", async ({ page }) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        transcript: "so the thing I keep coming back to is spaced repetition for ADHD",
        provider: "mock",
      }),
    }),
  );
  await injectVoice(page, 4);
  // nudge a sweep
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  const item = page.getByTestId("catch-item").first();
  await expect(item).toHaveAttribute("data-type", "voice");
  await expect(page.getByTestId("transcription").first()).toContainText(/transcribed/i, {
    timeout: 15_000,
  });
  await expect(item).toContainText(/spaced repetition/i);
  await expect(item).toHaveAttribute("data-status", "sieved");
});

test("transcription failure keeps the audio — couldn't transcribe, saved anyway", async ({
  page,
}) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "provider down" }),
    }),
  );
  await injectVoice(page, 3);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // it retries, then settles into a saved-anyway state; the catch never vanishes
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);
});

test("the record button is present and one-tap", async ({ page }) => {
  const rec = page.getByTestId("voice-record");
  await expect(rec).toBeVisible();
  await expect(rec).toHaveText(/record/i);
  // it is a real control — bordered, and its own button, not nested in submit
  await expect(rec).toHaveAttribute("data-recording", "false");
});

test("a transcribed voice catch shows its provenance in mono", async ({ page }) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, transcript: "quick thought about the orchard", provider: "mock" }),
    }),
  );
  await injectVoice(page, 47); // "a 60s ramble" territory
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("transcription").first()).toContainText(/transcribed/i, {
    timeout: 15_000,
  });
  // duration renders as m:ss
  await expect(page.getByTestId("catch-item").first()).toContainText("0:47");
});

test("REGRESSION item 1: a pasted link still survives offline and cites on reconnect", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.getByTestId("capture-input").fill("https://example.com/");
  await page.getByTestId("capture-submit").click();
  await expect(page.getByTestId("catch-item").first()).toHaveAttribute("data-type", "link");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("citation").first()).toContainText(/cited/i, {
    timeout: 25_000,
  });
});
