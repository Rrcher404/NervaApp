import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { reviewCard, type AnswerFeel } from "@/lib/srs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEELS: AnswerFeel[] = ["answered", "easy", "shaky"];

/**
 * Answer a question card in your own words (§9 stage 3 — The Return).
 * The human does the epistemic rep (retrieval + elaboration); the machine does
 * the clerical scheduling. Answering advances FSRS state and MINTS A BRICK,
 * atomically, via answer_card(). Runs as the user's session — RLS scopes it.
 *
 * The FSRS grade is derived from the gesture, never from the user managing a
 * review calendar: a plain answer = Good; the optional "easy"/"shaky" taps only
 * refine the interval (shaky = see it sooner = help, not punishment).
 */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let cardId: unknown, answer: unknown, feel: unknown;
  try {
    ({ cardId, answer, feel } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  if (typeof cardId !== "string") {
    return NextResponse.json({ ok: false, error: "missing cardId" }, { status: 400 });
  }
  if (typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "an answer in your own words is required" },
      { status: 400 },
    );
  }
  const answerFeel: AnswerFeel = FEELS.includes(feel as AnswerFeel)
    ? (feel as AnswerFeel)
    : "answered";

  // read the card's current FSRS state (RLS ensures it's the user's own)
  const { data: card, error: readErr } = await sb
    .from("question_cards")
    .select("fsrs_state")
    .eq("id", cardId)
    .single();
  if (readErr || !card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  // advance the schedule in TS (ts-fsrs), then persist + mint the brick atomically
  const review = reviewCard(card.fsrs_state, answerFeel);
  const { data: brickId, error: writeErr } = await sb.rpc("answer_card", {
    p_card_id: cardId,
    p_user_answer: answer.trim(),
    p_fsrs_state: review.fsrs_state,
    p_due_at: review.due_at,
  });
  if (writeErr) {
    return NextResponse.json({ ok: false, error: writeErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    brickId,
    intervalDays: review.interval_days,
    dueAt: review.due_at,
  });
}
