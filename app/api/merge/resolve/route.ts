import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The human makes the merge call the audit only proposed. Accept folds the
 * threads together; dismiss marks the pair dismissed forever (it never
 * resurfaces). Either way the epistemic decision is the human's (§5).
 */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let proposalId: unknown, accept: unknown;
  try {
    ({ proposalId, accept } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  if (typeof proposalId !== "string" || typeof accept !== "boolean") {
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
  }
  const { error } = await sb.rpc("resolve_merge", {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
