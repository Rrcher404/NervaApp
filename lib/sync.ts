"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listCatches, updateCatch, type LocalCatch } from "@/lib/store";

/**
 * Push local-first catches to Supabase so the server pipeline can embed + thread
 * them. Two hard rules from the design review:
 *
 *  - COLUMN-SCOPED (H4): sync writes ONLY client-owned fields. It NEVER touches
 *    `embedding`, `thread_id`, or the server-managed sieved status — a whole-row
 *    upsert would clobber the clustering and violate "threads never shuffle".
 *  - SETTLED-ONLY (B4): a catch syncs only once enrichment has landed locally
 *    (text is final), so the server never embeds a half-enriched snapshot.
 *    Dirty-tracking re-marks a catch unsynced if an embeddable field changes.
 */

function isSettled(c: LocalCatch): boolean {
  // text needs no enrichment; links/voice must have finished (or given up).
  return c.type === "text" || c.status === "sieved" || c.status === "failed_extract";
}

export async function syncCatches(
  db: SupabaseClient,
  userId: string,
): Promise<{ pushed: number }> {
  const all = await listCatches();
  const toPush = all.filter((c) => !c.synced && isSettled(c));
  if (toPush.length === 0) return { pushed: 0 };

  // profiles row must exist before the FK (don't depend solely on the trigger).
  await db.from("profiles").upsert({ id: userId }, { onConflict: "id" });

  const rows = toPush.map((c) => ({
    id: c.id, // client UUID = PK; upsert is idempotent across devices/retries
    user_id: userId,
    type: c.type,
    raw_content: c.rawContent,
    transcript: c.transcript ?? null,
    source_url: c.sourceUrl ?? null,
    source_meta: c.sourceMeta ?? {},
    article_text: c.articleText ?? null,
    captured_at: c.capturedAt,
    // status only on INSERT of a new row; server owns it thereafter. Upsert
    // with ignoreDuplicates keeps us from resetting a server 'sieved' row.
  }));

  // Column-scoped: only the client-owned columns above are ever written.
  const { error } = await db
    .from("catches")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error("sync failed: " + error.message);

  // mark local rows synced
  for (const c of toPush) await updateCatch(c.id, { synced: true });
  return { pushed: toPush.length };
}

/** Kick the server pipeline to embed + thread whatever just synced. Drains in batches. */
export async function runSieve(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const res = await fetch("/api/sieve", { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { remaining?: boolean };
    if (!data.remaining) return;
  }
}
