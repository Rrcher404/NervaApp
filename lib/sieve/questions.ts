/**
 * Question-card generation (MASTER-PLAN §9 stage 2: "generates one question card
 * per meaningful catch"; §7 build item 4).
 *
 * Constitution line (§5): the AI is the textbook, never the ghostwriter. This
 * function writes the QUESTION — clerical work, the elaborative-interrogation
 * prompt the user would never bother to write for themselves. It must NOT write,
 * hint, or imply the ANSWER — that is the human's epistemic rep. The question is
 * the machine speaking; it renders in mono. The answer is the human's material;
 * it renders in serif.
 *
 * Style: QFT / elaborative interrogation (Dunlosky) — a "why / how / what would
 * have to be true" question that forces retrieval and connection, never a
 * closed factual quiz with a lookup answer.
 */

const BULK_MODEL = "gemini-flash-lite-latest"; // CLAUDE.md §2 bulk model

export async function generateQuestion(catchText: string): Promise<string | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  const text = catchText.trim();
  if (text.length < 12) return null; // too thin to interrogate meaningfully

  const prompt =
    "You write ONE question about a research note, to be answered later from memory by the person who saved it.\n\n" +
    "Rules:\n" +
    "- The question must force the reader to RETRIEVE and ELABORATE in their own words (why does this matter, how does it connect, what would have to be true, what follows from it).\n" +
    "- NEVER state, hint, or imply the answer. You are asking, not teaching.\n" +
    "- Not a closed factual quiz. Not 'what does X mean'. Ask the question that turns a scrap into understanding.\n" +
    "- One sentence. Output ONLY the question, no preamble, no quotes.\n" +
    "- If the note is too vacuous to ask a real question about, output exactly: SKIP.\n\n" +
    "NOTE:\n" +
    text.slice(0, 1200);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${BULK_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8000 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const q = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    if (!q || q.toUpperCase() === "SKIP" || q.length > 300) return null;
    // Guard the constitution mechanically: a question ENDS in a '?'. If the model
    // returned a statement (an answer in disguise), reject it.
    if (!q.includes("?")) return null;
    return q;
  } catch {
    return null;
  }
}
