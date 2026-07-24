import { NextRequest, NextResponse } from "next/server";
import { extractLinkMeta } from "@/lib/sieve/extract";
import { readBodyCapped } from "@/lib/sieve/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A URL is short. Anything past this is not a URL — refuse before parsing. */
const MAX_BODY_BYTES = 64 * 1024;
/** A single URL over 8KB is pathological (and won't parse to anything useful). */
const MAX_URL_LEN = 8192;

/**
 * Enrichment is ALWAYS a second-class citizen. The catch is already saved
 * locally before this is ever called. This route can fail, hang, 500, or
 * never be reached — none of that may lose a catch.
 *
 * Returns 200 with ok:false rather than an error status, because the client
 * treats "couldn't extract, saved anyway" as a normal outcome, not an error.
 */
export async function POST(req: NextRequest) {
  // Stream the body with a hard cap — bounded regardless of Content-Length
  // (a chunked body omits the header, so a header check is a no-op against it).
  const raw = await readBodyCapped(req, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });
  }

  let url: unknown;
  try {
    ({ url } = JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return NextResponse.json({ ok: false, error: "bad request body" });
  }
  if (typeof url !== "string" || !url || url.length > MAX_URL_LEN) {
    return NextResponse.json({ ok: false, error: "missing or oversized url" });
  }
  const result = await extractLinkMeta(url);
  return NextResponse.json(result);
}
