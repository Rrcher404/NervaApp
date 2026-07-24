"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * "Show this once, then remember it's been seen" — for one-time lesson moments and
 * ritual acknowledgements. Backed by localStorage but read through
 * useSyncExternalStore, which is the React-blessed way to read an external store:
 * SSR renders the server snapshot (seen → nothing), then reveals AFTER hydration
 * with no mismatch and no setState-in-effect. Returns [shouldShow, markSeen].
 */
export function useSeenOnce(key: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);
  const seen = useSyncExternalStore(
    () => () => {}, // nothing external mutates it mid-session; no subscription needed
    () => {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return true; // no storage → treat as seen (a lesson that never nags beats one that errors)
      }
    },
    () => true, // server snapshot: seen, so SSR renders nothing and there's no flash-then-hide
  );
  const markSeen = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* best-effort */
    }
  }, [key]);
  return [!seen && !dismissed, markSeen];
}
