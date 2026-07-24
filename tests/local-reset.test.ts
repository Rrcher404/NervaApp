import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

/**
 * THE ANONYMOUS-SESSION RESET.
 *
 * IndexedDB is origin-scoped, so on a shared / kiosk browser a prior visitor's
 * catches would greet the next person. clearSyncedCatches (sign-in reclaim) and
 * clearLocalCatches (demo reset / "start fresh") close that leak. The one law
 * they may never break: capture is sacred — a catch that is still being made,
 * or one that has no durable copy elsewhere, must survive the reset.
 *
 * Assertions are by id membership, not absolute count: like the property suite,
 * these don't reset the DB between tests (deleteDatabase blocks on the module's
 * memoised connection), so state leaks across runs and only the delta is sound.
 */

let store: typeof import("@/lib/store");

async function idsOnDisk(): Promise<Set<string>> {
  return new Set((await store.listCatches()).map((c) => c.id));
}

beforeEach(async () => {
  store = await import("@/lib/store");
});

describe("clearSyncedCatches — sign-in reclaim", () => {
  it("removes synced catches but keeps unsynced (local-only) ones", async () => {
    const synced = await store.addCatch("pushed to the server");
    await store.updateCatch(synced.id, { synced: true });
    const unsynced = await store.addCatch("still only local");

    const removed = await store.clearSyncedCatches();
    const ids = await idsOnDisk();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(ids.has(synced.id)).toBe(false); // durable copy exists → reclaimed
    expect(ids.has(unsynced.id)).toBe(true); // no server copy → sacred, preserved
  });

  it("never reclaims an in-progress recording, even if marked synced", async () => {
    // A recording:true draft is a catch still being made. Nothing — not even a
    // stray synced flag — may let a reset delete it.
    const draftId = await store.startVoiceCatch();
    await store.updateCatch(draftId, { synced: true });

    await store.clearSyncedCatches();

    expect((await idsOnDisk()).has(draftId)).toBe(true);
  });
});

describe("clearLocalCatches — demo reset / start fresh", () => {
  it("wipes settled catches whatever their sync state", async () => {
    const a = await store.addCatch("visitor one, link");
    const b = await store.addCatch("visitor one, note");
    await store.updateCatch(b.id, { synced: true });

    await store.clearLocalCatches();
    const ids = await idsOnDisk();

    expect(ids.has(a.id)).toBe(false);
    expect(ids.has(b.id)).toBe(false);
  });

  it("preserves an in-progress recording (capture is sacred)", async () => {
    const draftId = await store.startVoiceCatch();
    const settled = await store.addCatch("a finished thought");

    const removed = await store.clearLocalCatches();
    const ids = await idsOnDisk();

    expect(ids.has(draftId)).toBe(true); // the live recording survives the wipe
    expect(ids.has(settled.id)).toBe(false);
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  it("a capture that lands after the snapshot is not lost", async () => {
    // clearLocalCatches deletes only the rows it read at entry. A capture racing
    // the reset (the hyperfocus burst pattern) must survive.
    const before = await store.addCatch("caught before the wipe");
    await store.clearLocalCatches();
    const after = await store.addCatch("caught right after the wipe");

    const ids = await idsOnDisk();
    expect(ids.has(before.id)).toBe(false);
    expect(ids.has(after.id)).toBe(true);
  });
});
