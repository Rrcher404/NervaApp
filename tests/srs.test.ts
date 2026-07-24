import { describe, it, expect } from "vitest";
import { newCard, reviewCard, RETURN_QUEUE_CAP, State } from "../lib/srs";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const days = (iso: string, from: Date) =>
  (new Date(iso).getTime() - from.getTime()) / 86_400_000;

describe("srs — The Return scheduler (ripen, never rot)", () => {
  it("a new card is due immediately (first exposure), State.New, zero reps", () => {
    const c = newCard(NOW);
    expect(c.due_at).toBe(NOW.toISOString());
    expect(c.fsrs_state.state).toBe(State.New);
    expect(c.fsrs_state.reps).toBe(0);
  });

  it("answering advances FSRS state and pushes the card DAYS into the future, not minutes", () => {
    const c = newCard(NOW);
    const r = reviewCard(c.fsrs_state, "answered", NOW);
    // day-scale (enable_short_term:false) — not a 10-minute learning step
    expect(days(r.due_at, NOW)).toBeGreaterThanOrEqual(1);
    expect(r.state).toBe(State.Review);
    expect(r.interval_days).toBeGreaterThanOrEqual(1);
    // the stored state is serialisable (due is an ISO string, round-trippable)
    expect(typeof r.fsrs_state.due).toBe("string");
  });

  it("intervals only GROW on repeated success — the schedule itself never rots", () => {
    let state: unknown = newCard(NOW).fsrs_state;
    let at = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = reviewCard(state, "answered", at);
      intervals.push(r.interval_days);
      state = r.fsrs_state;
      at = new Date(r.due_at);
    }
    // strictly non-decreasing, and genuinely spacing out (3, 14, 57, …)
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
    expect(intervals[intervals.length - 1]).toBeGreaterThan(intervals[0]);
  });

  it("'still shaky' brings the card back SOONER than a plain answer — help, not punishment", () => {
    const first = reviewCard(newCard(NOW).fsrs_state, "answered", NOW);
    const at = new Date(first.due_at);
    const good = reviewCard(first.fsrs_state, "answered", at);
    const shaky = reviewCard(first.fsrs_state, "shaky", at);
    const easy = reviewCard(first.fsrs_state, "easy", at);
    expect(shaky.interval_days).toBeLessThan(good.interval_days);
    expect(easy.interval_days).toBeGreaterThan(good.interval_days);
    // even 'shaky' still moves FORWARD — no negative interval, no lost progress
    expect(shaky.interval_days).toBeGreaterThanOrEqual(0);
    expect(new Date(shaky.due_at).getTime()).toBeGreaterThan(at.getTime());
  });

  it("answering LATE (a missed card, days overdue) is not penalised — it still banks forward", () => {
    const c = newCard(NOW);
    // user returns 30 days after it came due — the ND relapse case
    const late = new Date(NOW.getTime() + 30 * 86_400_000);
    const r = reviewCard(c.fsrs_state, "answered", late);
    // still schedules forward from when they actually showed up; no lapse wall
    expect(new Date(r.due_at).getTime()).toBeGreaterThan(late.getTime());
    expect(r.interval_days).toBeGreaterThanOrEqual(1);
  });

  it("the daily queue cap is a small, humane number", () => {
    expect(RETURN_QUEUE_CAP).toBeGreaterThan(0);
    expect(RETURN_QUEUE_CAP).toBeLessThanOrEqual(7);
  });
});
