import { describe, it, expect } from "vitest";
import { generateQuests, sieveDayKey, type QuestContext } from "../lib/quests";

const USER = "11111111-1111-1111-1111-111111111111";
const DAY = new Date("2026-07-24T15:00:00Z");

const fullCtx: QuestContext = {
  dueCards: 2,
  unsortedCatches: 3,
  provisionalThreads: [{ id: "t1", name: "marathon training" }],
  lonelyThreads: [{ id: "t2", name: "oat milk" }],
  recentCatch: { id: "c1", title: "a paper on FSRS" },
};

describe("generateQuests — deterministic, date-seeded, from the user's own notes (§6.4)", () => {
  it("is deterministic: same user + same day + same state ⇒ identical quests", () => {
    const a = generateQuests(fullCtx, USER, DAY);
    const b = generateQuests(fullCtx, USER, DAY);
    expect(a).toEqual(b);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it("rotates across sieve-days (the selection/order is keyed to the day)", () => {
    const today = generateQuests(fullCtx, USER, DAY, 2);
    const nextWeek = generateQuests(fullCtx, USER, new Date("2026-07-31T15:00:00Z"), 2);
    // both valid; the day is part of the seed so the pick is allowed to differ.
    // Assert stability WITHIN a day and that ids are day-stamped (so they vanish/rotate).
    expect(today.every((q) => q.id.includes(sieveDayKey(DAY)))).toBe(true);
    expect(nextWeek.every((q) => q.id.includes(sieveDayKey(new Date("2026-07-31T15:00:00Z"))))).toBe(true);
  });

  it("only surfaces quests whose condition actually holds — never invented busywork", () => {
    const empty: QuestContext = { dueCards: 0, unsortedCatches: 0, provisionalThreads: [], lonelyThreads: [] };
    expect(generateQuests(empty, USER, DAY)).toEqual([]);
    const onlyDue: QuestContext = { dueCards: 1, unsortedCatches: 0, provisionalThreads: [], lonelyThreads: [] };
    const q = generateQuests(onlyDue, USER, DAY);
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("answer_due");
    expect(q[0].href).toBe("/return");
  });

  it("respects the max cap", () => {
    expect(generateQuests(fullCtx, USER, DAY, 2)).toHaveLength(2);
    expect(generateQuests(fullCtx, USER, DAY, 3).length).toBeLessThanOrEqual(3);
  });

  it("sieve-day boundary is 04:00 (a 1am moment belongs to the previous day)", () => {
    const lateNight = new Date("2026-07-24T03:00:00Z"); // before 04:00 UTC
    const morning = new Date("2026-07-24T09:00:00Z");
    expect(sieveDayKey(lateNight)).not.toBe(sieveDayKey(morning));
  });
});
