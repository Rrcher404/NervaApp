import type { NextRequest } from "next/server";

/**
 * Read a request body with a HARD byte cap enforced BY STREAMING, not by
 * trusting Content-Length.
 *
 * Voss, item-2 regrade: the Content-Length check was a no-op against chunked
 * transfer encoding (the standard way any client streams a body of unknown
 * length) — `content-length` is absent, `Number(null ?? "0")` is 0, and the
 * cap never fires. A 500MB chunked upload spiked +1.5GB before the post-hoc
 * size check ran. This reads the actual stream, counts bytes as they arrive,
 * and aborts the instant the running total exceeds the cap — so the memory a
 * hostile body can force is bounded to `cap`, whatever headers it sends.
 *
 * Returns null when the cap is exceeded (the caller should 413).
 */
export async function readBodyCapped(
  req: NextRequest,
  cap: number,
): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => {});
        return null; // over cap — stop reading, memory stays bounded
      }
      chunks.push(value);
    }
  } catch {
    return null; // malformed stream — treat as unacceptable
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
