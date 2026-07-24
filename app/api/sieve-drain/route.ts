import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sieveForUser } from "@/lib/sieve/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Server-side pipeline drain (pg_cron → here). The interactive /api/sieve runs
 * only when a user opens /threads; this drains everyone's backlog on a schedule
 * so a Gemini outage that piled up embedding=null catches doesn't sit invisibly
 * until someone reloads. Per-user isolation; wall-clock bounded.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AUDIT_SECRET;
  const provided = req.headers.get("x-audit-secret") ?? "";
  if (!secret || !safeEqual(secret, provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const started = Date.now();

  // Heartbeat: a dead drain (endpoint 404/500) is otherwise indistinguishable
  // from a healthy one, because pg_net reports the SQL as succeeded regardless.
  // This row is the honest record that the drain actually ran to completion.
  const { data: run } = await admin.from("drain_runs").insert({}).select("id").single();
  const runId = run?.id;
  let runError: string | null = null;

  // distinct users with catches still needing embed or threading (deduped
  // server-side — the cap is on users, not catches).
  const { data: rows } = await admin.rpc("users_with_pending_catches");
  const userIds = (rows as string[] | null) ?? [];

  let drained = 0;
  for (const uid of userIds) {
    if (Date.now() > started + 50_000) break; // stay under the function budget
    try {
      for (let i = 0; i < 20; i++) {
        if (Date.now() > started + 50_000) break;
        const res = await sieveForUser(admin, uid, started + 50_000);
        drained++;
        if (!res.remaining) break;
      }
    } catch (e) {
      runError = (runError ? runError + "; " : "") + (e instanceof Error ? e.message : "user failed");
    }
  }

  if (runId) {
    await admin
      .from("drain_runs")
      .update({
        completed_at: new Date().toISOString(),
        users: userIds.length,
        batches: drained,
        error: runError,
      })
      .eq("id", runId);
  }
  return NextResponse.json({ ok: true, users: userIds.length, batches: drained });
}
