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

  // users with catches still needing embed or threading
  const { data: rows } = await admin
    .from("catches")
    .select("user_id")
    .neq("status", "failed_extract")
    .or("embedding.is.null,thread_id.is.null")
    .limit(2000);
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];

  let drained = 0;
  for (const uid of userIds) {
    if (Date.now() > started + 50_000) break; // stay under the function budget
    try {
      // drain this user in batches until done or time runs low
      for (let i = 0; i < 20; i++) {
        if (Date.now() > started + 50_000) break;
        const res = await sieveForUser(admin, uid);
        drained++;
        if (!res.remaining) break;
      }
    } catch {
      // one user's failure must not stop the drain for everyone else
      continue;
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, batches: drained });
}
