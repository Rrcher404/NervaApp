import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * The health endpoint an EXTERNAL probe (a $0 GitHub Action / cron-job.org) hits
 * from OFF this Supabase project, so the reliability system can be observed from
 * outside the pg_cron it otherwise lives inside (the ship-check's load-bearing
 * residual). It reports UNHEALTHY on either:
 *   - LIVENESS: no fresh healthy drain (30m) or audit (26h), or an open ops_alert.
 *   - EFFICACY: a real backlog of un-embedded catches despite the drain running,
 *     or a spike of pipeline failures in `events`. This is the part a
 *     drain-heartbeat-only check misses — sieveForUser returns ok:true on a
 *     sustained Gemini outage (failures route to events, not drain_runs.error),
 *     so a dead embed key reads GREEN on the drain but RED here.
 *
 * Returns 200 when healthy, 503 when not — so an uptime service can alert on the
 * status code alone. Secret-guarded (reuses AUDIT_SECRET) since it reads internals.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.AUDIT_SECRET;
  const provided =
    req.headers.get("x-audit-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (!secret || !safeEqual(secret, provided)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const nowMs = Date.now();
  const iso = (msAgo: number) => new Date(nowMs - msAgo).toISOString();

  const [drain, audit, alerts, backlog, failures] = await Promise.all([
    admin.from("drain_runs").select("id", { count: "exact", head: true })
      .not("completed_at", "is", null).is("error", null).gt("started_at", iso(30 * 60_000)),
    admin.from("audit_runs").select("id", { count: "exact", head: true })
      .not("completed_at", "is", null).is("error", null).gt("started_at", iso(26 * 3_600_000)),
    admin.from("ops_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null),
    // catches that should have been embedded by now but weren't — the efficacy tell
    admin.from("catches").select("id", { count: "exact", head: true })
      .is("embedding", null).neq("status", "failed_extract").lt("captured_at", iso(15 * 60_000)),
    // pipeline failures logged in the last hour
    admin.from("events").select("id", { count: "exact", head: true })
      .in("kind", ["embed_failed", "embed_write_failed", "assign_failed", "question_gen_failed", "card_discovery_failed"])
      .gt("created_at", iso(60 * 60_000)),
  ]);

  const checks = {
    drain_fresh: (drain.count ?? 0) > 0,
    audit_fresh: (audit.count ?? 0) > 0,
    no_open_alerts: (alerts.count ?? 0) === 0,
    embed_backlog: backlog.count ?? 0,
    recent_failures: failures.count ?? 0,
  };
  // Any read error is itself a health failure (don't report green on a broken read).
  const readError = [drain, audit, alerts, backlog, failures].some((r) => r.error);
  const healthy =
    !readError &&
    checks.drain_fresh &&
    checks.audit_fresh &&
    checks.no_open_alerts &&
    checks.embed_backlog === 0 &&
    checks.recent_failures < 25;

  return NextResponse.json(
    { ok: healthy, checks, readError },
    { status: healthy ? 200 : 503 },
  );
}
