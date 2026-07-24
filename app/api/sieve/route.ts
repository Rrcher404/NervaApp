import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embed, embeddableText, EMBEDDING_MODEL } from "@/lib/sieve/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ASSIGN_THRESHOLD = 0.72;
const BATCH = 20; // cap work per call; the client re-triggers until drained

/**
 * The Sieve pipeline. For the signed-in user's catches that are synced but not
 * yet embedded, embed the human's words (+ enrichment) and run the serialized
 * in-DB threader. Runs as the service key (RLS inert) so EVERY query is scoped
 * to the authenticated user_id; the owner-match trigger is the backstop.
 *
 * Idempotent: only picks up catches with embedding IS NULL, and the assign
 * function no-ops a catch that already has a thread.
 */
export async function POST() {
  // Identity comes from the user's session cookie, NEVER from the request body.
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  const admin = supabaseAdmin();

  // catches that reached the client 'sieved'/'raw' state, synced, no embedding yet
  const { data: pending, error } = await admin
    .from("catches")
    .select("id, raw_content, transcript, article_text, source_meta, captured_at")
    .eq("user_id", user.id)
    .is("embedding", null)
    .neq("status", "failed_extract")
    .order("captured_at", { ascending: true }) // canonical order — determinism
    .limit(BATCH);
  if (error) return NextResponse.json({ ok: false, error: error.message });

  let embedded = 0;
  let threaded = 0;
  for (const c of pending ?? []) {
    const text = embeddableText({
      rawContent: c.raw_content,
      transcript: c.transcript,
      articleText: c.article_text,
      sourceMeta: c.source_meta,
    });
    if (!text) continue;
    const e = await embed(text);
    if (!e.ok || !e.embedding) continue; // leave it; a later call retries

    const vec = JSON.stringify(e.embedding);
    const { error: upErr } = await admin
      .from("catches")
      .update({ embedding: vec, embedding_model: EMBEDDING_MODEL, status: "sieved" })
      .eq("id", c.id)
      .eq("user_id", user.id); // scope — RLS is inert on the service key
    if (upErr) continue;
    embedded++;

    const { error: assignErr } = await admin.rpc("assign_catch_to_thread", {
      p_catch_id: c.id,
      p_user_id: user.id,
      p_embedding: vec,
      p_model: EMBEDDING_MODEL,
      p_threshold: ASSIGN_THRESHOLD,
    });
    if (!assignErr) threaded++;
  }

  const remaining = (pending?.length ?? 0) === BATCH;
  return NextResponse.json({ ok: true, embedded, threaded, remaining });
}
