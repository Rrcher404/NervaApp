/**
 * Transcription. Server-side only.
 *
 * DEVIATION FROM THE PLAN, and why: MASTER-PLAN §9 names Groq
 * whisper-large-v3-turbo (primary) + OpenAI Whisper (fallback). At build time
 * (July 2026) there is no Groq key, the OpenAI key is out of quota, and the
 * plan's own gemini-2.5-flash-lite returns "no longer available to new users"
 * — Gemini 3.x is current. Gemini transcribes audio natively and verbatim
 * (verified), and consolidating transcription onto Gemini honours §9's stronger
 * principle — "one vendor, one SDK, one bill" — better than a three-vendor
 * transcription stack. So: Gemini is primary; Groq and OpenAI Whisper remain
 * wired as fallbacks and light up automatically if their keys appear.
 *
 * Capture is sacred: this can fail freely. The recording is already on disk.
 */

export interface TranscribeResult {
  ok: boolean;
  transcript?: string;
  provider?: string;
  error?: string;
}

/**
 * TOTAL budget across ALL provider attempts, kept under the route's
 * maxDuration (60s). Previously each attempt got its own 60s, so two providers
 * could run 120s against a 60s function cap — Vercel would kill it before the
 * fallback finished, turning graceful degradation into a 504. A shared deadline
 * fixes that.
 */
const TOTAL_BUDGET_MS = 50_000;
/** A current, stable Gemini alias — tracks the latest flash-lite, so it can't
 *  go stale the way a pinned 2.5-flash-lite did. */
const GEMINI_MODEL = "gemini-flash-lite-latest";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return buf.toString("base64");
}

/** Gemini native audio transcription. `deadline` is the shared budget's end. */
async function viaGemini(audio: Blob, deadline: number): Promise<TranscribeResult> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return { ok: false, provider: "gemini", error: "no key" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try {
    const data = await blobToBase64(audio);
    const body = {
      contents: [
        {
          parts: [
            {
              text: "Transcribe this audio verbatim. Output only the transcript text, with no preamble, labels, or commentary. If there is no discernible speech, output an empty string.",
            },
            { inline_data: { mime_type: audio.type || "audio/webm", data } },
          ],
        },
      ],
      // Deterministic transcription — no creative latitude.
      generationConfig: { temperature: 0 },
    };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, provider: "gemini", error: `${res.status}: ${t.slice(0, 160)}` };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const transcript = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    if (!transcript) return { ok: false, provider: "gemini", error: "empty transcript" };
    return { ok: true, transcript, provider: "gemini" };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, provider: "gemini", error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Whisper-compatible providers (Groq, OpenAI) — same API shape, different host. */
async function viaWhisper(
  audio: Blob,
  name: string,
  baseUrl: string,
  key: string,
  model: string,
  deadline: number,
): Promise<TranscribeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try {
    const form = new FormData();
    form.append("file", audio, "capture.webm");
    form.append("model", model);
    form.append("response_format", "json");
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, provider: name, error: `${res.status}: ${t.slice(0, 160)}` };
    }
    const data = (await res.json()) as { text?: string };
    const transcript = (data.text ?? "").trim();
    if (!transcript) return { ok: false, provider: name, error: "empty transcript" };
    return { ok: true, transcript, provider: name };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, provider: name, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribe(audio: Blob): Promise<TranscribeResult> {
  // One shared deadline across all attempts — the sum can never exceed the
  // route's function cap (the header's "Gemini primary" ordering, now matched
  // by the code).
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const attempts: Array<() => Promise<TranscribeResult>> = [];

  // Gemini first — the funded, one-vendor choice (§9). Groq and OpenAI are
  // fallbacks that light up only if their keys appear. Each skipped without a key.
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    attempts.push(() => viaGemini(audio, deadline));
  }
  if (process.env.GROQ_API_KEY) {
    attempts.push(() =>
      viaWhisper(
        audio,
        "groq",
        "https://api.groq.com/openai/v1",
        process.env.GROQ_API_KEY!,
        "whisper-large-v3-turbo",
        deadline,
      ),
    );
  }
  if (process.env.OPENAI_API_KEY) {
    attempts.push(() =>
      viaWhisper(
        audio,
        "openai",
        "https://api.openai.com/v1",
        process.env.OPENAI_API_KEY!,
        "whisper-1",
        deadline,
      ),
    );
  }

  if (attempts.length === 0) {
    return { ok: false, error: "no transcription provider configured" };
  }

  let last: TranscribeResult = { ok: false, error: "no attempt made" };
  for (const attempt of attempts) {
    if (Date.now() >= deadline) break; // out of shared budget — degrade now
    last = await attempt();
    if (last.ok) return last;
  }
  return last; // all failed — caller keeps the audio and degrades
}
