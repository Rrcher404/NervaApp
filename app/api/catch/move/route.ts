import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The human overrides the machine's filing — move a catch to another thread or
 * to the Inbox (toThreadId: null). This is epistemic control (§5), NOT the
 * banned machine reshuffle: the machine only ever proposes; the human moves.
 * Runs as the user's session — RLS + SECURITY INVOKER scope it to their rows.
 */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let catchId: unknown, toThreadId: unknown;
  try {
    ({ catchId, toThreadId } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  if (typeof catchId !== "string") {
    return NextResponse.json({ ok: false, error: "missing catchId" }, { status: 400 });
  }
  const { error } = await sb.rpc("move_catch", {
    p_catch_id: catchId,
    p_to_thread: typeof toThreadId === "string" ? toThreadId : null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
