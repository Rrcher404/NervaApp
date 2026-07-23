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
}

const DB_NAME = "sieve";
const DB_VERSION = 1;
const CATCHES = "catches";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CATCHES)) {
        const store = db.createObjectStore(CATCHES, { keyPath: "id" });
        store.createIndex("capturedAt", "capturedAt");
        store.createIndex("status", "status");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
export async function addCatch(rawContent: string): Promise<LocalCatch> {
  const { type, sourceUrl } = detectType(rawContent);
  const item: LocalCatch = {
    id: crypto.randomUUID(),
    type,
    rawContent: rawContent.trim(),
    sourceUrl,
    sourceMeta: {},
    status: "raw",
    capturedAt: new Date().toISOString(),
    synced: false,
    enrichAttempts: 0,
  };
  await tx("readwrite", (s) => s.put(item));
  return item;
}

export async function updateCatch(
  id: string,
  patch: Partial<LocalCatch>,
): Promise<LocalCatch | undefined> {
  const existing = await tx<LocalCatch | undefined>("readonly", (s) => s.get(id));
  if (!existing) return undefined;
  const next = { ...existing, ...patch, id };
  await tx("readwrite", (s) => s.put(next));
  return next;
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
      c.enrichAttempts < 5,
  );
}

/** Catches not yet pushed to Supabase (used by sync when signed in). */
export async function unsyncedCatches(): Promise<LocalCatch[]> {
  const all = await listCatches();
  return all.filter((c) => !c.synced);
}
