/**
 * Embeddings. Server-side only.
 *
 * Gemini `gemini-embedding-001` at outputDimensionality=1536 — matches the
 * schema's vector(1536), verified against the live API. OpenAI's
 * text-embedding-3-small (the plan's choice) is out of quota, and consolidating
 * on Gemini keeps §9's "one vendor, one SDK, one bill" — the same reasoning as
 * transcription. The model id is stored PER CATCH and PER THREAD so a future
 * model swap can never silently scramble the vector space of existing history.
 */

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMS = 1536;

/**
 * taskType=CLUSTERING is not optional — it's the difference between working and
 * not. Empirically (verified against the live API): with the default taskType,
 * same-topic cosine (~0.68) is indistinguishable from cross-topic (~0.48 with
 * noise crossing over) and NOTHING clusters cleanly. With CLUSTERING, same-topic
 * lands 0.82-0.86 and cross-topic 0.62-0.67 — real separation. The plan's 0.75
 * threshold was tuned for OpenAI's distribution; Gemini needs its own tuning
 * (see THREAD_ASSIGN_THRESHOLD in the threading layer).
 */
const TASK_TYPE = "CLUSTERING";
const TIMEOUT_MS = 30_000;

export interface EmbedResult {
  ok: boolean;
  embedding?: number[];
  model?: string;
  error?: string;
}

/**
 * The text a catch is embedded from. LEADS with the human's own words
 * (transcript / raw note), because the named trust-killer is "why is my recipe
 * in my thesis thread" — a catch clustered by a long scraped article body
 * instead of by what the user actually meant. The article is included but
 * truncated hard so it can't dominate the human's intent.
 */
export function embeddableText(c: {
  rawContent?: string | null;
  transcript?: string | null;
  articleText?: string | null;
  sourceMeta?: { title?: string; description?: string } | null;
}): string {
  const human = (c.transcript || c.rawContent || "").trim();
  const title = (c.sourceMeta?.title || "").trim();
  const description = (c.sourceMeta?.description || "").trim();
  const article = (c.articleText || "").trim();
  const parts = [
    human, // the user's words come first — this is what "this catch means"
    title,
    description,
    article.slice(0, 1500), // the body is context, not the identity of the catch
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 8000).trim();
}

/** L2-normalize a vector to unit length. */
function l2Normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

export async function embed(text: string): Promise<EmbedResult> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return { ok: false, error: "no embedding provider configured" };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "nothing to embed" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: trimmed }] },
          outputDimensionality: EMBEDDING_DIMS,
          taskType: TASK_TYPE,
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${t.slice(0, 160)}` };
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const values = json.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIMS) {
      return { ok: false, error: `unexpected embedding shape (${values?.length ?? 0} dims)` };
    }
    // B1: Gemini's 1536-dim output is NOT pre-normalized. Store unit vectors so
    // avg()-centroids are true direction means, not magnitude-weighted (a long
    // article would otherwise hijack the centroid — invisible to cosine tests).
    const embedding = l2Normalize(values);
    return { ok: true, embedding, model: EMBEDDING_MODEL };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Cosine similarity of two equal-length vectors, for tests and app-side checks. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("dimension mismatch");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
