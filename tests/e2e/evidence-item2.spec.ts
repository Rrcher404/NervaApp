import { test, type Page } from "@playwright/test";

/** Committee evidence for item 2 (voice). Screenshots to journal/screens/. */

const DIR = "journal/screens";

async function injectVoice(page: Page, seconds: number) {
  await page.evaluate(
    ([secs]) =>
      new Promise<void>((resolve, reject) => {
        const sr = 8000;
        const n = sr * secs;
        const buf = new ArrayBuffer(44 + n * 2);
        const v = new DataView(buf);
        const w = (o: number, s: string) => {
          for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
        };
        w(0, "RIFF");
        v.setUint32(4, 36 + n * 2, true);
        w(8, "WAVE");
        w(12, "fmt ");
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, sr, true);
        v.setUint32(28, sr * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        w(36, "data");
        v.setUint32(40, n * 2, true);
        const rec = {
          id: crypto.randomUUID(),
          type: "voice",
          rawContent: "",
          sourceMeta: {},
          status: "raw",
          capturedAt: new Date().toISOString(),
          synced: false,
          enrichAttempts: 0,
          audioData: buf,
          audioType: "audio/wav",
          durationMs: secs * 1000,
        };
        const req = indexedDB.open("sieve", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("catches")) {
            const s = db.createObjectStore("catches", { keyPath: "id" });
            s.createIndex("capturedAt", "capturedAt");
            s.createIndex("status", "status");
          }
        };
        req.onsuccess = () => {
          const t = req.result.transaction("catches", "readwrite");
          t.objectStore("catches").put(rec);
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
        };
        req.onerror = () => reject(req.error);
      }),
    [seconds] as const,
  );
}

test("item 2 evidence trail", async ({ page }) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        transcript:
          "So the thing I keep coming back to is spaced repetition for people with ADHD — the evidence is surprisingly strong.",
        provider: "gemini",
      }),
    }),
  );

  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await page.getByTestId("capture-input").waitFor();

  // 1. the record button, cold
  await page.screenshot({ path: `${DIR}/item2-01-record-button.png`, fullPage: true });

  // 2. a voice catch mid-transcription
  await injectVoice(page, 47);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByTestId("transcription").first().waitFor();
  await page
    .getByTestId("transcription")
    .first()
    .waitFor({ state: "visible" });

  // 3. transcribed — the transcript is the human's material, provenance in mono
  await page
    .locator('[data-testid="catch-item"][data-status="sieved"]')
    .first()
    .waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${DIR}/item2-02-transcribed.png`, fullPage: true });
});
