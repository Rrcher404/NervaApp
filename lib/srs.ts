import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";

/**
 * ts-fsrs wrapper for The Return (Appendix A §9; MASTER-PLAN §7 "keep ts-fsrs").
 *
 * Design choices, all downstream of the constitution:
 * - `enable_short_term: false` — schedule in DAYS from the first answer, not
 *   10-minute learning steps. A research-resurfacing app wants a card back in
 *   3 days, then 14, then 57 — not twice in one session. Intervals only GROW on
 *   success: 3 → 14 → 57 → 196 days. This IS "ripen, never rot" in the schedule
 *   itself (§6): a card's next appearance never comes SOONER because you did well.
 * - `enable_fuzz: false` — deterministic, so the acceptance certificate and unit
 *   tests can assert exact due dates. At this volume fuzz buys nothing.
 * - The human NEVER manages a review calendar (§9 stage 3). Answering in your own
 *   words IS the grade: the act of retrieval maps to Good. Two optional, skippable
 *   taps ("that was easy" / "still shaky") give FSRS finer signal without ever
 *   asking the user to schedule anything. "Still shaky" shortens the interval —
 *   that is the system HELPING (see it sooner), not punishing; nothing decays,
 *   nothing is lost, no rep is taken back.
 */

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    enable_short_term: false,
    // Cap intervals at 10 years so the scheduler AGREES with answer_card's
    // due_at <= now()+10y bound. ts-fsrs defaults maximum_interval to 36500 days
    // (~100y); left there, a card past ~7 successful reps would compute an honest
    // due_at beyond 10y that the DB rejects as 'invalid schedule' — a legitimate
    // answer refused. 3650 days (~10y) keeps TS and the DB consistent.
    maximum_interval: 3650,
  }),
);

/** Daily Return queue cap (MASTER-PLAN §7: "cap the daily queue, silent drop"). */
export const RETURN_QUEUE_CAP = 5;

/** How the user's single gesture becomes an FSRS grade. Answering = Good. */
export type AnswerFeel = "answered" | "easy" | "shaky";
export function feelToRating(feel: AnswerFeel): Grade {
  switch (feel) {
    case "easy":
      return Rating.Easy;
    case "shaky":
      return Rating.Hard;
    case "answered":
    default:
      return Rating.Good;
  }
}

/** The card object as stored in question_cards.fsrs_state (jsonb). */
export type StoredFsrs = Omit<FsrsCard, "due" | "last_review"> & {
  due: string;
  last_review?: string;
};

function toStored(card: FsrsCard): StoredFsrs {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  };
}

/** Rehydrate a stored card's Date fields; tolerate an empty/absent state. */
function fromStored(state: unknown, now: Date): FsrsCard {
  if (!state || typeof state !== "object" || !("due" in state)) {
    // A card whose fsrs_state was never initialised — treat as brand new.
    return createEmptyCard(now);
  }
  const s = state as StoredFsrs;
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learning_steps,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

/**
 * A brand-new card: due immediately (first exposure), State.New. The Return
 * surfaces it on the next pass; answering it is its first review.
 */
export function newCard(now: Date = new Date()): { fsrs_state: StoredFsrs; due_at: string } {
  const card = createEmptyCard(now);
  return { fsrs_state: toStored(card), due_at: card.due.toISOString() };
}

export interface ReviewResult {
  fsrs_state: StoredFsrs;
  due_at: string;
  /** days until the card returns — for the "see you in N days" confirmation. */
  interval_days: number;
  state: State;
}

/**
 * Answer a card: advance its FSRS state by the grade the gesture implies.
 * `now` is injectable for deterministic tests. Never decreases retained
 * progress; a missed card (never answered) simply stays due — the caller
 * requeues it by leaving due_at in the past (no decay, no lapse penalty applied
 * until the human actually engages).
 */
export function reviewCard(
  storedState: unknown,
  feel: AnswerFeel,
  now: Date = new Date(),
): ReviewResult {
  const card = fromStored(storedState, now);
  const rating = feelToRating(feel);
  const next = scheduler.next(card, now, rating).card;
  const intervalDays = Math.max(
    0,
    Math.round((next.due.getTime() - now.getTime()) / 86_400_000),
  );
  return {
    fsrs_state: toStored(next),
    due_at: next.due.toISOString(),
    interval_days: intervalDays,
    state: next.state,
  };
}

export { Rating, State };
