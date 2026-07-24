import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MERGE_THRESHOLD = 0.8;
const NAME_MODEL = "gemini-flash-latest";
const NAME_LIMIT = 20; // threads named per run — re-entrant, WHERE name IS NULL

/** Constant-time string compare so the shared secret can't be timing-probed. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function nameThread(catchTexts: string[]): Promise<string | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  const prompt =
    "These are short research notes that were automatically grouped together. Give the group a 2-4 word title naming their shared subject. Output only the title, no quotes, no punctuation. If they have no coherent shared subject, output exactly: MIXED.\n\n" +
    catchTexts.slice(0, 12).map((t, i) => `${i + 1}. ${t.slice(0, 200)}`).join("\n");
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${NAME_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8000 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const name = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    // Coherence gate: don't slap a confident wrong label on an incoherent thread.
    if (!name || name.toUpperCase() === "MIXED" || name.length > 60) return null;
    return name;
  } catch {
    return null;
  }
}

/**
 * The nightly audit (pg_cron → pg_net → here). Per user: name unnamed threads
 * and propose merges. NEVER moves catches. Writes an audit_runs heartbeat so a
 * silent cron death (fire-and-forget http_post reports SQL success even on a
 * 500) becomes visible.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AUDIT_SECRET;
  const provided = req.headers.get("x-audit-secret") ?? "";
  if (!secret || !safeEqual(secret, provided)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: run } = await admin
    .from("audit_runs")
    .insert({})
    .select("id")
    .single();
  const runId = run?.id;

  let named = 0;
  let proposals = 0;
  let scanned = 0;
  let error: string | null = null;

  try {
    // distinct users who have threads
    const { data: users } = await admin.from("threads").select("user_id");
    const userIds = [...new Set((users ?? []).map((u) => u.user_id))];

    for (const uid of userIds) {
      // name unnamed threads (re-entrant, provisional, coherence-gated)
      const { data: unnamed } = await admin
        .from("threads")
        .select("id")
        .eq("user_id", uid)
        .is("name", null)
        .limit(NAME_LIMIT);
      for (const t of unnamed ?? []) {
        scanned++;
        const { data: members } = await admin
          .from("catches")
          .select("raw_content, transcript, source_meta")
          .eq("user_id", uid)
          .eq("thread_id", t.id)
          .limit(12);
        const texts = (members ?? []).map(
          (m) =>
            (m.source_meta as { title?: string } | null)?.title ||
            m.transcript ||
            m.raw_content ||
            "",
        );
        const name = await nameThread(texts);
        if (name) {
          await admin
            .from("threads")
            .update({ name, name_provisional: true })
            .eq("id", t.id)
            .eq("user_id", uid);
          named++;
        }
      }
      // propose merges (in-DB, correct operator, pair-keyed, skips dismissed)
      const { data: n } = await admin.rpc("propose_merges", {
        p_user_id: uid,
        p_threshold: MERGE_THRESHOLD,
      });
      proposals += typeof n === "number" ? n : 0;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "audit failed";
  }

  if (runId) {
    await admin
      .from("audit_runs")
      .update({
        completed_at: new Date().toISOString(),
        threads_scanned: scanned,
        proposals_written: proposals,
        threads_named: named,
        error,
      })
      .eq("id", runId);
  }

  return NextResponse.json({ ok: !error, named, proposals, scanned, error });
}
