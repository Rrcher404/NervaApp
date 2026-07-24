import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sieveForUser } from "@/lib/sieve/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The Sieve pipeline for the signed-in user: embed their pending catches + run
 * the serialized in-DB threader. Identity from the session cookie, never the
 * body. Runs as the service key (RLS inert) so every query scopes user_id; the
 * owner-match trigger backstops it.
 */
export async function POST() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  const result = await sieveForUser(supabaseAdmin(), user.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
