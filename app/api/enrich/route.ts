import { NextRequest, NextResponse } from "next/server";
import { extractLinkMeta } from "@/lib/sieve/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enrichment is ALWAYS a second-class citizen. The catch is already saved
 * locally before this is ever called. This route can fail, hang, 500, or
 * never be reached — none of that may lose a catch.
 *
 * Returns 200 with ok:false rather than an error status, because the client
 * treats "couldn't extract, saved anyway" as a normal outcome, not an error.
 */
export async function POST(req: NextRequest) {
  let url: unknown;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad request body" });
  }
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ ok: false, error: "missing url" });
  }
  const result = await extractLinkMeta(url);
  return NextResponse.json(result);
}
