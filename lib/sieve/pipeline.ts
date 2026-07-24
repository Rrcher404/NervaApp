import { supabaseAdmin } from "@/lib/supabase/admin";
import { embed, embeddableText, EMBEDDING_MODEL } from "@/lib/sieve/embed";

export const ASSIGN_THRESHOLD = 0.72;
export const SIEVE_BATCH = 20;

export interface SieveResult {
  ok: boolean;
  embedded: number;
  threaded: number;
  failed: number;
  remaining: boolean;
  error?: string;
}

/**
 * Surface every failure — the class the committee named ("standing disposition
 * to swallow errors"). Every swallow site in the pipeline routes through here
 * so the events table is the single, honest record of what didn't work.
 */
async function logFailure(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  kind: string,
  catchId: string,
  error: string,
): Promise<void> {
  await admin
    .from("events")
    .insert({ user_id: userId, kind, payload: { catch_id: catchId, error } })
    .then(() => {}, () => {}); // logging must never itself throw into the pipeline
}

/**
 * Embed + thread one user's pending catches. Shared by the interactive route
 * and the cron drain.
 *
 * Picks up BOTH not-yet-embedded catches AND orphans (embedded-but-unthreaded):
 * a crash between the embedding write and the assign RPC — two autocommits —
 * would otherwise strand a catch forever. Both re-drive the idempotent assign;
 * only the un-embedded pay for an embedding. Every failure is recorded to the
 * events table, never silently swallowed.
 */
export async function sieveForUser(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  deadlineMs = Date.now() + 50_000,
): Promise<SieveResult> {
  const { data: pending, error } = await admin
    .from("catches")
    .select("id, raw_content, transcript, article_text, source_meta, embedding, embedding_model")
    .eq("user_id", userId)
    .neq("status", "failed_extract")
    .or("embedding.is.null,thread_id.is.null")
    .order("captured_at", { ascending: true }) // canonical order — determinism
    .limit(SIEVE_BATCH);
  if (error) return { ok: false, embedded: 0, threaded: 0, failed: 0, remaining: false, error: error.message };

  let embedded = 0;
  let threaded = 0;
  let failed = 0;
  let ranOut = false;
  for (const c of pending ?? []) {
    // Inner wall-clock guard: one heavy user under slow Gemini must not blow the
    // whole function budget before the between-user check ever runs.
    if (Date.now() > deadlineMs) {
      ranOut = true;
      break;
    }
    let vec = c.embedding as string | null;
    let model = c.embedding_model as string | null;

    if (!vec) {
      const text = embeddableText({
        rawContent: c.raw_content,
        transcript: c.transcript,
        articleText: c.article_text,
        sourceMeta: c.source_meta,
      });
      if (!text) {
        await admin.from("catches").update({ status: "failed_extract" }).eq("id", c.id).eq("user_id", userId);
        continue;
      }
      const e = await embed(text);
      if (!e.ok || !e.embedding) {
        failed++;
        await logFailure(admin, userId, "embed_failed", c.id, e.error ?? "unknown");
        continue;
      }
      vec = JSON.stringify(e.embedding);
      model = EMBEDDING_MODEL;
      const { error: upErr } = await admin
        .from("catches")
        .update({ embedding: vec, embedding_model: model, status: "sieved" })
        .eq("id", c.id)
        .eq("user_id", userId);
      if (upErr) {
        failed++;
        await logFailure(admin, userId, "embed_write_failed", c.id, upErr.message);
        continue;
      }
      embedded++;
    }

    const { error: assignErr } = await admin.rpc("assign_catch_to_thread", {
      p_catch_id: c.id,
      p_user_id: userId,
      p_embedding: vec,
      p_model: model ?? EMBEDDING_MODEL,
      p_threshold: ASSIGN_THRESHOLD,
    });
    if (!assignErr) threaded++;
    else {
      failed++;
      await logFailure(admin, userId, "assign_failed", c.id, assignErr.message);
    }
  }

  // "remaining" if we filled a batch OR bailed on the clock — either way there
  // is more to do and the caller should come back.
  return {
    ok: true,
    embedded,
    threaded,
    failed,
    remaining: ranOut || (pending?.length ?? 0) === SIEVE_BATCH,
  };
}
