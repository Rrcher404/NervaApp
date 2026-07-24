import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/sieve/transcribe";

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
  // Reject on Content-Length BEFORE parsing. formData() buffers the whole body
  // first, so a post-hoc .size check pays exactly the memory cost the cap is
  // meant to prevent — an 800MB upload spiked +1.7GB before being rejected.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_AUDIO_BYTES + 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "audio too large" }, { status: 413 });
  }

  let audio: Blob;
  try {
    const form = await req.formData();
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
