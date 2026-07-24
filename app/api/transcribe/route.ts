import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/sieve/transcribe";
import { readBodyCapped } from "@/lib/sieve/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cap accepted audio at 25MB — Whisper's own limit, and a sane blast-radius. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Transcription is second-class, like enrichment. The recording is already on
 * disk before this is called. 200 + ok:false is a normal outcome, not an error
 * — the client treats "couldn't transcribe, saved anyway" as expected.
 */
export async function POST(req: NextRequest) {
  // Stream the body with a hard cap BEFORE parsing — bounded regardless of
  // Content-Length (chunked uploads omit it, defeating a header check).
  const raw = await readBodyCapped(req, MAX_AUDIO_BYTES + 1024 * 1024);
  if (raw === null) {
    return NextResponse.json({ ok: false, error: "audio too large" }, { status: 413 });
  }

  let audio: Blob;
  try {
    // Parse the already-capped bytes as multipart via Response.formData().
    const form = await new Response(new Blob([raw as BlobPart]), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "no audio" });
    }
    if (file.size === 0) return NextResponse.json({ ok: false, error: "empty audio" });
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ ok: false, error: "audio too large" });
    }
    audio = file;
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" });
  }

  const result = await transcribe(audio);
  return NextResponse.json(result);
}
