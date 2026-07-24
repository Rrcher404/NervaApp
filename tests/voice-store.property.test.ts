import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import "fake-indexeddb/auto";
import { tooDeeplyNested } from "@/lib/sieve/extract";

/**
 * Item-2 rework regressions, as invariants where possible.
 */

let store: typeof import("@/lib/store");
beforeEach(async () => {
  store = await import("@/lib/store");
});

describe("voice — the sacred write and durability lifecycle", () => {
  it("addVoiceCatch REJECTS an empty recording (not only the UI does)", async () => {
    await expect(store.addVoiceCatch(new Blob([]), 0)).rejects.toThrow();
  });

  it("addVoiceCatch persists a non-empty recording as an ArrayBuffer", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const c = await store.addVoiceCatch(new Blob([bytes], { type: "audio/webm" }), 4200);
    const got = (await store.listCatches()).find((x) => x.id === c.id)!;
    expect(got.type).toBe("voice");
    expect(got.audioData).toBeInstanceOf(ArrayBuffer);
    expect(got.audioData!.byteLength).toBe(5);
    expect(got.durationMs).toBe(4200);
  });

  it("a draft flushes to disk during recording and is recovered after a crash", async () => {
    const id = await store.startVoiceCatch();
    // draft is NOT yet eligible for transcription
    expect((await store.pendingTranscription()).some((c) => c.id === id)).toBe(false);

    // flush some audio, as the recorder would every few seconds
    const buf = new Uint8Array([9, 9, 9, 9]).buffer;
    await store.flushVoiceAudio(id, buf, "audio/webm", 3000);

    // ...then the tab dies before finalize(). The draft is still on disk.
    const onDisk = (await store.listCatches()).find((c) => c.id === id)!;
    expect(onDisk.recording).toBe(true);
    expect(onDisk.audioData!.byteLength).toBe(4);

    // next load: recovery adopts it
    await store.recoverVoiceDrafts();
    const recovered = (await store.listCatches()).find((c) => c.id === id)!;
    expect(recovered.recording).toBe(false);
    // and NOW it is eligible for transcription — the ramble survived the crash
    expect((await store.pendingTranscription()).some((c) => c.id === id)).toBe(true);
  });

  it("recovery drops a draft that never captured any audio", async () => {
    const id = await store.startVoiceCatch();
    await store.recoverVoiceDrafts();
    expect((await store.listCatches()).some((c) => c.id === id)).toBe(false);
  });

  it("finalize with empty audio drops the draft rather than keeping an empty catch", async () => {
    const id = await store.startVoiceCatch();
    const result = await store.finalizeVoiceCatch(id, new ArrayBuffer(0), "audio/webm", 0);
    expect(result).toBeUndefined();
    expect((await store.listCatches()).some((c) => c.id === id)).toBe(false);
  });
});

describe("never-downgrade covers voice transcripts, not just link titles", () => {
  it("a sieved voice catch's transcript is never overwritten by an empty later write", async () => {
    const c = await store.addVoiceCatch(new Blob([new Uint8Array([1])]), 1000);
    await store.updateCatch(c.id, {
      status: "sieved",
      rawContent: "the real transcript I actually said",
      transcript: "the real transcript I actually said",
    });
    // a losing cross-tab sweep lands a failure afterward
    const after = await store.updateCatch(c.id, {
      sourceMeta: { extractError: "provider down" },
      bumpAttempts: true,
      statusFromAttempts: true,
    });
    expect(after!.status).toBe("sieved");
    expect(after!.transcript).toBe("the real transcript I actually said");
    expect(after!.rawContent).toBe("the real transcript I actually said");
  });
});

describe("the Readability depth guard bounds the parse-hang input", () => {
  it("flags pathologically nested HTML and passes normal articles", () => {
    const deep = "<div>".repeat(1500) + "x" + "</div>".repeat(1500);
    expect(tooDeeplyNested(deep)).toBe(true);

    const normal =
      "<html><body><article>" +
      "<p>A paragraph.</p>".repeat(200) +
      "</article></body></html>";
    expect(tooDeeplyNested(normal)).toBe(false);
  });

  it("does not miscount void elements as nesting (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (n) => {
        // n <br> tags nest zero levels — must never trip the guard
        const html = "<br>".repeat(n);
        expect(tooDeeplyNested(html)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });
});
