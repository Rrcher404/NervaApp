"use client";

import { useCallback, useRef } from "react";
import {
  pendingEnrichment,
  pendingTranscription,
  updateCatch,
  catchAudioBlob,
  type LocalCatch,
} from "@/lib/store";

/**
 * The enrichment sweep, extracted from Capture so voice and link paths share
 * one mutex and one set of hard-won guarantees:
 *   - a single sweep at a time (overlapping sweeps corrupt state)
 *   - every store write individually guarded (a failed write must not abandon
 *     the batch or escape as an unhandled rejection — the shape that HALTed us)
 *   - network failure and store failure never share a catch
 *   - a sieved catch is never downgraded
 *
 * `refresh` re-reads the list into the UI after each item.
 */
export function useSweep(refresh: () => Promise<void>) {
  const sweepingRef = useRef(false);

  const enrichLink = useCallback(
    async (c: LocalCatch) => {
      let data: {
        ok?: boolean;
        title?: string;
        siteName?: string;
        description?: string;
        error?: string;
      } | null = null;
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: c.sourceUrl }),
        });
        data = await res.json();
      } catch {
        data = null;
      }
      if (data?.ok) {
        await updateCatch(c.id, {
          status: "sieved",
          sourceMeta: {
            title: data.title,
            siteName: data.siteName,
            description: data.description,
            extractError: undefined,
          },
          bumpAttempts: true,
        });
      } else {
        await updateCatch(c.id, {
          sourceMeta: data
            ? { siteName: data.siteName, extractError: data.error }
            : { extractError: "couldn't reach the network" },
          bumpAttempts: true,
          statusFromAttempts: true,
        });
      }
    },
    [],
  );

  const transcribeVoice = useCallback(
    async (c: LocalCatch) => {
      const blob = catchAudioBlob(c);
      if (!blob) return;
      let data: { ok?: boolean; transcript?: string; error?: string } | null = null;
      try {
        const form = new FormData();
        form.append("audio", blob, "capture.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        data = await res.json();
      } catch {
        data = null;
      }
      if (data?.ok && data.transcript) {
        await updateCatch(c.id, {
          status: "sieved",
          rawContent: data.transcript,
          transcript: data.transcript,
          sourceMeta: { extractError: undefined },
          bumpAttempts: true,
        });
      } else {
        await updateCatch(c.id, {
          sourceMeta: {
            extractError: data?.error ?? "couldn't reach the network",
          },
          bumpAttempts: true,
          statusFromAttempts: true,
        });
      }
    },
    [],
  );

  const sweep = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (sweepingRef.current) return; // mutex
    sweepingRef.current = true;
    try {
      let links: LocalCatch[] = [];
      let voice: LocalCatch[] = [];
      try {
        [links, voice] = await Promise.all([
          pendingEnrichment(),
          pendingTranscription(),
        ]);
      } catch {
        return; // store unreachable; refresh() already told the user
      }

      for (const c of [...links, ...voice]) {
        try {
          await updateCatch(c.id, { status: "sieving" });
          await refresh();
          if (c.type === "voice") await transcribeVoice(c);
          else await enrichLink(c);
          await refresh();
        } catch {
          // store failed for this catch; the capture itself is safe on disk.
          continue;
        }
      }
    } finally {
      sweepingRef.current = false;
    }
  }, [refresh, enrichLink, transcribeVoice]);

  return sweep;
}
