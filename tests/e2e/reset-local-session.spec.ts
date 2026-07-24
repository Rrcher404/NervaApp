import { test, expect, type Page } from "@playwright/test";

/**
 * ANONYMOUS-SESSION RESET on a shared / kiosk browser.
 *
 * IndexedDB is origin-scoped, so without a reset the previous stranger's catches
 * greet the next one — a leak the §7 "FIRST CATCH LOGGED in front of a stranger"
 * demo may run straight into. Two mechanisms, both proven here in-browser:
 *   1. `/?fresh=1` — the presenter's reset before each stranger walk.
 *   2. "Not yours? Start fresh" — the visitor's own two-step clear.
 */

async function capture(page: Page, text: string) {
  await page.getByTestId("capture-input").fill(text);
  await page.getByTestId("capture-submit").click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("sieve"));
  await page.reload();
  await expect(page.getByTestId("capture-input")).toBeVisible();
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("THE CRITERION: /?fresh=1 wipes the prior visitor's catches and strips the param", async ({
  page,
}) => {
  // Visitor one leaves a catch behind.
  await capture(page, "visitor one was here");
  await expect(page.getByTestId("catch-item")).toHaveCount(1);

  // Presenter resets for the next stranger walk.
  await page.goto("/?fresh=1");
  await expect(page.getByTestId("capture-input")).toBeVisible();

  // Clean slate — and the URL no longer carries the wipe, so a reload or a
  // shared link can't nuke the next real session.
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("catch-item")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);

  // And it truly reset the store, not just the view.
  await page.reload();
  await expect(page.getByTestId("empty-state")).toBeVisible();
});

test("the two-step Start fresh clears the browser, and Cancel does not", async ({
  page,
}) => {
  await capture(page, "someone else's note");
  await expect(page.getByTestId("catch-item")).toHaveCount(1);

  // Cancel is a genuine no-op — a stray tap must not wipe a real session.
  await page.getByTestId("start-fresh").click();
  await page.getByTestId("start-fresh-cancel").click();
  await expect(page.getByTestId("catch-item")).toHaveCount(1);

  // Confirm clears it.
  await page.getByTestId("start-fresh").click();
  await page.getByTestId("start-fresh-yes").click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("catch-item")).toHaveCount(0);
});

test("a reset never destroys an in-progress recording (capture is sacred)", async ({
  page,
}) => {
  // A draft mid-recording, with audio already flushed to disk — the one thing a
  // wipe must preserve. Written via raw IndexedDB (the store's API isn't reachable
  // from page context); the "catches" store already exists from the app's load.
  const DRAFT_ID = "reset-sacred-recording-draft";
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("sieve");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("catches", "readwrite");
          tx.objectStore("catches").put({
            id,
            type: "voice",
            rawContent: "",
            sourceMeta: {},
            status: "raw",
            capturedAt: new Date().toISOString(),
            synced: false,
            enrichAttempts: 0,
            recording: true,
            audioData: new ArrayBuffer(64), // flushed audio — a real ramble in progress
            audioType: "audio/webm",
            durationMs: 3000,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    DRAFT_ID,
  );

  // Presenter resets for the next stranger — the ramble must outlive the wipe.
  await page.goto("/?fresh=1");
  await expect(page.getByTestId("capture-input")).toBeVisible();

  const survived = await page.evaluate(
    (id) =>
      new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open("sieve");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction("catches").objectStore("catches").get(id);
          get.onsuccess = () => resolve(!!get.result);
          get.onerror = () => reject(get.error);
        };
      }),
    DRAFT_ID,
  );
  expect(survived).toBe(true);
});
