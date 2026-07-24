import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { discoverUsers } from "@/lib/sieve/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MERGE_THRESHOLD = 0.8;
const NAME_MODEL = "gemini-flash-latest";
const NAME_LIMIT = 20; // threads named per run — re-entrant, WHERE name IS NULL

/** Constant-time compare via the platform primitive (no length leak, no JIT games). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // compare against self to keep the timing uniform, then fail
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
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
  const startedMs = Date.now();

  try {
    // distinct users who have threads — deduped server-side so the ~1000-row
    // cap is on USERS, not threads (past that a keyset cursor is needed).
    // discoverUsers surfaces an RPC failure instead of swallowing it into an
    // empty list that would write audit_runs green with users=0.
    const discovery = await discoverUsers(admin, "users_with_threads");
    const userIds = discovery.userIds;
    if (discovery.error) error = discovery.error; // → audit_runs.error; dead-man fires

    for (const uid of userIds) {
      // PER-USER ISOLATION: one poison user must not abort every user after it.
      // A wall-clock guard keeps the whole run inside the function budget.
      if (Date.now() > startedMs + 50_000) break; // leave headroom under maxDuration
      try {
        // name unnamed threads (re-entrant, provisional, coherence-gated)
        const { data: unnamed } = await admin
          .from("threads")
          .select("id")
          .eq("user_id", uid)
          .is("name", null)
          .limit(NAME_LIMIT);
        for (const t of unnamed ?? []) {
          // Inner wall-clock guard — 20 names × a 20s Gemini timeout would blow
          // the budget before the between-user check runs.
          if (Date.now() > startedMs + 50_000) break;
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
      } catch (e) {
        // record but keep going — the next user is not this user's hostage.
        error = (error ? error + "; " : "") + `user ${uid}: ${e instanceof Error ? e.message : "failed"}`;
      }
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
