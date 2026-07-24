import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The human names the thread. Setting a name clears name_provisional — the
 * machine's guess becomes the human's title. RLS scopes the update to the owner.
 */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let threadId: unknown, name: unknown;
  try {
    ({ threadId, name } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  const clean = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (typeof threadId !== "string" || !clean) {
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
  }
  const { error } = await sb
    .from("threads")
    .update({ name: clean, name_provisional: false })
    .eq("id", threadId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
