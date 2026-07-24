"use client";

import { useCallback, useRef } from "react";
import {
  pendingEnrichment,
  pendingTranscription,
  updateCatch,
  catchAudioBlob,
  type LocalCatch,
} from "@/lib/store";
import type { ExtractResult } from "@/lib/sieve/extract";
import type { TranscribeResult } from "@/lib/sieve/transcribe";

/** Interleave two lists round-robin, so neither type head-of-line-blocks the other. */
function roundRobin<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

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
      let data: ExtractResult | null = null;
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
          // articleText / author / publishedAt are persisted now, not discarded —
          // item 3's embeddings and claim extraction read them off the catch.
          sourceMeta: {
            title: data.title,
            siteName: data.siteName,
            description: data.description,
            author: data.author,
            publishedAt: data.publishedAt,
            extractError: undefined,
          },
          articleText: data.articleText,
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
      if (!blob) {
        // No audio on a pending voice catch (shouldn't happen — pendingTranscription
        // filters on audioData). If it ever does, TERMINATE it instead of looping
        // forever on "queued for transcription" with no error and no progress.
        await updateCatch(c.id, {
          sourceMeta: { extractError: "no audio recorded" },
          bumpAttempts: true,
          statusFromAttempts: true,
        });
        return;
      }
      let data: TranscribeResult | null = null;
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

      // Round-robin so a backlog of slow/dead links can't starve a ready voice
      // transcription (or vice versa) — one type's queue never blocks the other.
      for (const c of roundRobin(links, voice)) {
        // A link catch with no sourceUrl can't be enriched — invariant holds
        // today (detectType pairs type:"link" with a set sourceUrl), guarded
        // here for defence in depth after the item-2 sweep extraction.
        if (c.type === "link" && !c.sourceUrl) continue;
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
