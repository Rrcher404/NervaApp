import { describe, it, expect } from "vitest";
import { readBodyCapped } from "@/lib/sieve/read-body";
import type { NextRequest } from "next/server";

/**
 * The streaming body guard. Voss's regrade proved a Content-Length check is a
 * no-op against chunked transfer (the header is simply absent). These feed a
 * ReadableStream with NO length information at all — exactly the chunked case —
 * and assert the cap holds by counting bytes as they stream.
 */

function streamOf(totalBytes: number, chunk = 64 * 1024): NextRequest {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) return controller.close();
      const n = Math.min(chunk, totalBytes - sent);
      sent += n;
      controller.enqueue(new Uint8Array(n));
    },
  });
  // Only `.body` is used by readBodyCapped — a minimal shim, no Content-Length.
  return { body } as unknown as NextRequest;
}

describe("readBodyCapped — bounded regardless of Content-Length", () => {
  it("returns null (over cap) for a stream that exceeds the cap, even with no length header", async () => {
    const cap = 256 * 1024;
    const result = await readBodyCapped(streamOf(2 * 1024 * 1024), cap); // 2MB > 256KB
    expect(result).toBeNull();
  });

  it("returns the bytes for a stream under the cap", async () => {
    const cap = 256 * 1024;
    const result = await readBodyCapped(streamOf(100 * 1024), cap);
    expect(result).not.toBeNull();
    expect(result!.byteLength).toBe(100 * 1024);
  });

  it("stops reading promptly once the cap is crossed (does not buffer the whole stream)", async () => {
    // A 500MB stream must be rejected without ever accumulating 500MB.
    const cap = 1024 * 1024; // 1MB
    let produced = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += 256 * 1024;
        controller.enqueue(new Uint8Array(256 * 1024));
        if (produced > 500 * 1024 * 1024) controller.close();
      },
    });
    const req = { body } as unknown as NextRequest;
    const result = await readBodyCapped(req, cap);
    expect(result).toBeNull();
    // it aborted near the cap, not after producing the whole 500MB
    expect(produced).toBeLessThan(4 * 1024 * 1024);
  });

  it("handles an empty/absent body", async () => {
    const result = await readBodyCapped({ body: null } as unknown as NextRequest, 1024);
    expect(result).not.toBeNull();
    expect(result!.byteLength).toBe(0);
  });

  it("aborts a slow trickle-feed that never completes (time cap, not just byte cap)", async () => {
    // A stream that dribbles forever under the byte cap must not hold open.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        // one tiny chunk, then never resolve again — a trickle that stalls
        controller.enqueue(new Uint8Array(8));
      },
    });
    const req = { body } as unknown as NextRequest;
    const start = Date.now();
    const result = await readBodyCapped(req, 1024 * 1024, 300); // 300ms deadline
    expect(result).toBeNull();
    expect(Date.now() - start).toBeLessThan(2000); // bailed near the deadline
  });
});
