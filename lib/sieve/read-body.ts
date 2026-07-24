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
  timeoutMs = 15_000,
): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);

  // A byte cap and a time cap are different guarantees (Voss). Without a
  // deadline, a slow trickle-feed under the byte cap holds a connection open
  // for the platform's full request timeout — /api/enrich has no maxDuration
  // backstop at all. This bounds the whole read, not just its size.
  const deadline = Date.now() + timeoutMs;

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        await reader.cancel().catch(() => {});
        return null; // took too long — drop it
      }
      const read = (await Promise.race([
        reader.read(),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), remaining)),
      ])) as ReadableStreamReadResult<Uint8Array> | "timeout";
      if (read === "timeout") {
        await reader.cancel().catch(() => {});
        return null;
      }
      const { done, value } = read;
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
