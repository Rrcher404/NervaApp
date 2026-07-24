"use client";

import { clearLocalCatches } from "@/lib/store";

/**
 * Reset an anonymous session's local footprint on a shared / kiosk browser.
 *
 * IndexedDB and localStorage are both origin-scoped, so a prior visitor's
 * catches AND their one-time UI flags (the lesson they already dismissed) would
 * otherwise greet the next person. This clears both — the durable catch store
 * and the session-scoped localStorage keys — so a stranger walk starts clean.
 *
 * Capture is sacred: clearLocalCatches() preserves any in-progress recording,
 * so a reset can never destroy a catch that is still being made.
 */

/** Exact localStorage keys that belong to an anonymous session, not the browser. */
const SESSION_LS_KEYS = ["qft-lesson-seen"];
/** Prefixes for per-item session keys (e.g. return-draft-<cardId>). */
const SESSION_LS_PREFIXES = ["return-draft-"];

export async function resetLocalSession(): Promise<number> {
  const removed = await clearLocalCatches();
  try {
    for (const key of SESSION_LS_KEYS) localStorage.removeItem(key);
    // Sweep prefixed keys back-to-front — removeItem reindexes as we go.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && SESSION_LS_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // No storage (private mode) → nothing to clear. The catches are what matter
    // and they are already handled above; the flags are best-effort cosmetics.
  }
  return removed;
}
