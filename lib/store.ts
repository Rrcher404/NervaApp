/**
 * Local-first client store — the Selva shape discipline, adapted.
 *
 * LAW (CLAUDE.md → "Capture is sacred"): raw input persists HERE, locally,
 * before any network call, any enrichment, any sync. The UI never waits on
 * a round-trip. A capture must succeed with every external API down.
 *
 * IndexedDB via a thin promise wrapper. No dependencies.
 */

export type CatchType = "voice" | "link" | "text" | "image";
export type CatchStatus = "raw" | "sieving" | "sieved" | "failed_extract";

export interface SourceMeta {
  title?: string;
  siteName?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  /** set when enrichment gave up — the catch is still saved */
  extractError?: string;
}

export interface LocalCatch {
  id: string; // client-generated uuid — the same id syncs to Supabase
  type: CatchType;
  rawContent: string;
  sourceUrl?: string;
  sourceMeta: SourceMeta;
  transcript?: string;
  claimExtract?: string;
  status: CatchStatus;
  capturedAt: string; // ISO — the moment of capture, even offline
  synced: boolean; // pushed to Supabase yet?
  enrichAttempts: number;
  /**
   * Voice catches only: the raw recording as an ArrayBuffer, NOT a Blob.
   * WebKit (iOS Safari) fails to store Blobs in IndexedDB ("put failed"),
   * which would break voice capture on the primary mobile target. ArrayBuffers
   * structured-clone reliably everywhere; the Blob is reconstructed only at
   * upload time.
   */
  audioData?: ArrayBuffer;
  audioType?: string;
  /** Voice catches only: recording length, for the provenance line. */
  durationMs?: number;
}

const DB_NAME = "sieve";
const DB_VERSION = 1;
const CATCHES = "catches";
export const MAX_ENRICH_ATTEMPTS = 5;
/** A capture must never hang forever on a blocked or wedged database. */
const OPEN_TIMEOUT_MS = 4000;
/** Soft ceiling on a single capture. Generous — "pour everything in". */
export const MAX_CAPTURE_BYTES = 2_000_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  // Open BEFORE constructing the memoised promise.
  //
  // Safari private mode throws synchronously here. If that throw were handled
  // inside the Promise executor, its `dbPromise = null` would run DURING the
  // executor — i.e. before `dbPromise = new Promise(...)` completes — and the
  // pending assignment would immediately stomp the null. The memo would then
  // hold a rejected promise forever, so "try again" would be a lie for the rest
  // of the tab's life. The line looked identical to the two branches that work;
  // the difference is that those fire from asynchronous callbacks.
  let opened: IDBOpenDBRequest;
  try {
    opened = indexedDB.open(DB_NAME, DB_VERSION);
  } catch (e) {
    return Promise.reject(e); // never memoised — the next capture retries clean
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    let lateHandle: IDBOpenDBRequest | null = null;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      dbPromise = null; // let the next capture retry a fresh open
      // If the open eventually succeeds after we gave up, close the orphaned
      // connection — otherwise it lingers and blocks future version changes.
      if (lateHandle) {
        lateHandle.onsuccess = () => lateHandle?.result?.close();
      }
      reject(new Error("indexeddb open timed out"));
    }, OPEN_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = opened; // opened above, outside the memo — see the note there
    lateHandle = req;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CATCHES)) {
        const store = db.createObjectStore(CATCHES, { keyPath: "id" });
        store.createIndex("capturedAt", "capturedAt");
        store.createIndex("status", "status");
      }
    };
    req.onsuccess = () => finish(() => resolve(req.result));
    req.onerror = () =>
      finish(() => {
        dbPromise = null; // same reason: a retry must actually retry
        reject(req.error);
      });
    // Another tab holds an older version open — surface it, don't hang.
    req.onblocked = () =>
      finish(() => {
        dbPromise = null;
        reject(new Error("indexeddb blocked by another tab"));
      });
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(CATCHES, mode);
        const req = fn(t.objectStore(CATCHES));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** URL detection: a single pasted http(s) URL becomes a link catch. */
export function detectType(raw: string): { type: CatchType; sourceUrl?: string } {
  const trimmed = raw.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { type: "link", sourceUrl: trimmed };
  return { type: "text" };
}

/**
 * THE sacred write. Synchronous from the caller's point of view of the
 * network: no fetch happens before this resolves. Everything downstream
 * (enrich, sync) is async and failure-tolerant.
 */
/**
 * THE SACRED WRITE.
 *
 * Deliberately has NO content-based deduplication.
 *
 * A previous version dropped a capture whose text matched another within a
 * 2000ms window, to close a "same content from two tabs" finding. That was a
 * heuristic answering an identity question, and it could not tell a deliberate
 * repeat from a double-fire: typing "wait", submitting, pausing a second, and
 * typing "wait" again lost the second thought. Short repeated fragments are the
 * worst-day user's most likely input.
 *
 * The severities are not symmetric. A duplicate catch is a cosmetic annoyance
 * the user can ignore. A dropped catch is a constitutional violation. Where the
 * two are in tension, capture-is-sacred decides, and it decides toward keeping
 * the data. Same-gesture double-fire is handled where it actually belongs —
 * an in-flight guard on the submit handler. Two tabs are two gestures, and two
 * gestures are two catches.
 */
export async function addCatch(rawContent: string): Promise<LocalCatch> {
  const trimmed = rawContent.trim().slice(0, MAX_CAPTURE_BYTES);
  const { type, sourceUrl } = detectType(trimmed);
  const item: LocalCatch = {
    id: crypto.randomUUID(),
    type,
    rawContent: trimmed,
    sourceUrl,
    sourceMeta: {},
    status: "raw",
    capturedAt: new Date().toISOString(),
    synced: false,
    enrichAttempts: 0,
  };
  // One atomic put. IndexedDB transactions are already serialised, so no lock
  // is needed — and the lock that was here had no timeout, which serialised a
  // burst of captures behind a full-table scan and stalled hyperfocus harvest.
  await tx("readwrite", (s) => s.put(item));
  return item;
}

/**
 * The sacred write for VOICE. The recording persists to disk before any
 * transcription is attempted — CLAUDE.md: capture must succeed with every
 * external API down, and Whisper is an external API. A voice memo captured
 * offline sits safely on disk until the network returns, exactly like a link.
 *
 * IndexedDB stores Blobs natively, so the audio itself is durable — a failed
 * transcription never costs the user their recording, only its text.
 */
export async function addVoiceCatch(
  audioBlob: Blob,
  durationMs: number,
): Promise<LocalCatch> {
  // Read to an ArrayBuffer BEFORE the write — Blobs don't persist on WebKit.
  const audioData = await audioBlob.arrayBuffer();
  const item: LocalCatch = {
    id: crypto.randomUUID(),
    type: "voice",
    rawContent: "", // filled by the transcript; the audio IS the raw material
    sourceMeta: {},
    status: "raw",
    capturedAt: new Date().toISOString(),
    synced: false,
    enrichAttempts: 0,
    audioData,
    audioType: audioBlob.type || "audio/webm",
    durationMs,
  };
  await tx("readwrite", (s) => s.put(item));
  return item;
}

/** Reconstruct the recording Blob from stored bytes, for upload. */
export function catchAudioBlob(c: LocalCatch): Blob | null {
  if (!c.audioData) return null;
  return new Blob([c.audioData], { type: c.audioType || "audio/webm" });
}

/** Voice catches still awaiting a transcript. */
export async function pendingTranscription(): Promise<LocalCatch[]> {
  const all = await listCatches();
  return all.filter(
    (c) =>
      c.type === "voice" &&
      !!c.audioData &&
      (c.status === "raw" || c.status === "sieving") &&
      c.enrichAttempts < MAX_ENRICH_ATTEMPTS,
  );
}

export interface UpdateOptions {
  /** Increment enrichAttempts from the value ON DISK, not a stale snapshot. */
  bumpAttempts?: boolean;
  /** Derive status from the freshly-bumped attempt count. */
  statusFromAttempts?: boolean;
}

/**
 * Read-modify-write inside a SINGLE IndexedDB transaction.
 *
 * The previous version read in one transaction and wrote in another, so a
 * slower sweep could overwrite a faster one's result with a stale snapshot —
 * reverting a successfully-cited catch back to 'raw' and discarding its title.
 * Attempt counting is done from disk for the same reason.
 */
export async function updateCatch(
  id: string,
  patch: Partial<LocalCatch> & UpdateOptions,
): Promise<LocalCatch | undefined> {
  const { bumpAttempts, statusFromAttempts, ...fields } = patch;
  const db = await openDb();
  return new Promise<LocalCatch | undefined>((resolve, reject) => {
    const t = db.transaction(CATCHES, "readwrite");
    const store = t.objectStore(CATCHES);
    const get = store.get(id);
    get.onerror = () => reject(get.error);
    get.onsuccess = () => {
      const existing = get.result as LocalCatch | undefined;
      if (!existing) return resolve(undefined);

      const attempts = existing.enrichAttempts + (bumpAttempts ? 1 : 0);
      const next: LocalCatch = {
        ...existing,
        ...fields,
        // merge sourceMeta rather than replacing — a failed retry must not
        // erase a title an earlier success already wrote
        sourceMeta: fields.sourceMeta
          ? { ...existing.sourceMeta, ...fields.sourceMeta }
          : existing.sourceMeta,
        enrichAttempts: attempts,
        id,
      };
      if (statusFromAttempts) {
        next.status = attempts >= MAX_ENRICH_ATTEMPTS ? "failed_extract" : "raw";
      }
      // Never downgrade a catch that is already cited — and that protection
      // has to cover the METADATA too, not just the status field. A losing
      // sweep's failure would otherwise merge its extractError in alongside
      // the winning sweep's good title.
      if (existing.status === "sieved") {
        next.status = "sieved";
        next.sourceMeta = fields.sourceMeta?.title
          ? next.sourceMeta // a newer successful extraction may still update it
          : { ...existing.sourceMeta };
      }

      const put = store.put(next);
      put.onsuccess = () => resolve(next);
      put.onerror = () => reject(put.error);
    };
  });
}

export async function listCatches(): Promise<LocalCatch[]> {
  const all = await tx<LocalCatch[]>("readonly", (s) => s.getAll());
  // newest first
  return all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/** Link catches still waiting for a citation. */
export async function pendingEnrichment(): Promise<LocalCatch[]> {
  const all = await listCatches();
  return all.filter(
    (c) =>
      c.type === "link" &&
      (c.status === "raw" || c.status === "sieving") &&
      c.enrichAttempts < MAX_ENRICH_ATTEMPTS,
  );
}

/** Catches not yet pushed to Supabase (used by sync when signed in). */
export async function unsyncedCatches(): Promise<LocalCatch[]> {
  const all = await listCatches();
  return all.filter((c) => !c.synced);
}
