import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import "fake-indexeddb/auto";

/**
 * PROPERTY-BASED TESTS FOR THE SACRED WRITE.
 *
 * Why this file exists, in one sentence: the committee's example-based
 * regression tests all passed while a capture-dropping bug sat in the store,
 * because a test written to close a finding inherits that finding's blind spot.
 *
 * These assert the INVARIANT instead of the example:
 *
 *   For ANY sequence of captures, in any order, at any timing,
 *   the number persisted equals the number submitted.
 *
 * The 2s content-dedupe that shipped in rework cycle 2 would have died on the
 * very first shrink of `["a", "a"]`. That is the whole argument for this layer.
 */

let store: typeof import("@/lib/store");

/**
 * Deliberately NOT resetting the database between property runs.
 *
 * deleteDatabase() blocks on the module's memoised open connection, so a reset
 * either hangs or silently no-ops and leaks state across runs — which is
 * exactly what produced "expected 47 to be 2" on the first attempt at this file.
 * Asserting on the DELTA is both robust and a stronger property: it holds no
 * matter what else is already in the store.
 */
async function countCatches(): Promise<number> {
  return (await store.listCatches()).length;
}

beforeEach(async () => {
  store = await import("@/lib/store");
});

describe("capture is sacred — invariants", () => {
  it("persists EVERY submitted capture, whatever the content or order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 40 }), {
          minLength: 1,
          maxLength: 12,
        }),
        async (inputs) => {
          const meaningful = inputs.filter((i) => i.trim().length > 0);
          fc.pre(meaningful.length > 0);

          const before = await countCatches();
          for (const text of meaningful) {
            await store.addCatch(text);
          }
          const after = await countCatches();

          // THE invariant. No dedupe, no coalescing, no dropping — ever.
          expect(after - before).toBe(meaningful.length);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("persists deliberate repeats of identical text", async () => {
    // The exact shape rework cycle 2 broke.
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2, max: 6 }),
        async (text, times) => {
          fc.pre(text.trim().length > 0);
          const before = await countCatches();
          for (let i = 0; i < times; i++) await store.addCatch(text);
          const after = await countCatches();
          expect(after - before).toBe(times);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("gives every capture a unique id", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 2,
          maxLength: 10,
        }),
        async (inputs) => {
          const meaningful = inputs.filter((i) => i.trim().length > 0);
          fc.pre(meaningful.length > 1);
          for (const t of meaningful) await store.addCatch(t);
          const ids = (await store.listCatches()).map((c) => c.id);
          expect(new Set(ids).size).toBe(ids.length);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("never loses content: what goes in comes back out verbatim (to the cap)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (text) => {
        fc.pre(text.trim().length > 0);
        const created = await store.addCatch(text);
        const got = (await store.listCatches()).find((c) => c.id === created.id);
        expect(got!.rawContent).toBe(text.trim().slice(0, store.MAX_CAPTURE_BYTES));
      }),
      { numRuns: 60 },
    );
  });

  it("enrichAttempts is monotonic — it never decreases", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (bumps) => {
        const c = await store.addCatch("https://example.com/");
        let last = c.enrichAttempts;
        for (let i = 0; i < bumps; i++) {
          const next = await store.updateCatch(c.id, { bumpAttempts: true });
          expect(next!.enrichAttempts).toBeGreaterThanOrEqual(last);
          last = next!.enrichAttempts;
        }
      }),
      { numRuns: 30 },
    );
  });

  it("a sieved catch can never be downgraded by a later update", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("raw" as const, "sieving" as const, "failed_extract" as const),
        async (attempt) => {
          const c = await store.addCatch("https://example.com/");
          await store.updateCatch(c.id, {
            status: "sieved",
            sourceMeta: { title: "Real Title", siteName: "example.com" },
          });
          const after = await store.updateCatch(c.id, { status: attempt });
          expect(after!.status).toBe("sieved");
          // and the citation survives
          expect(after!.sourceMeta.title).toBe("Real Title");
        },
      ),
      { numRuns: 30 },
    );
  });
});
