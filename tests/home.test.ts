import { describe, it, expect } from "vitest";
import { computeReentry, oneNextTile } from "../lib/home";

const NOW = new Date("2026-07-24T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

// §6: absence is never a gap. The return greeting must never scold.
const BANNED = /streak|missed|behind|gap|lost|broke|failed|overdue|days? in a row|don'?t break|come on|where have you been/i;

describe("computeReentry — silent grace, loud warm return (§6.2)", () => {
  it("a brand-new user (no prior activity) is not 'returning' and gets no gap", () => {
    const r = computeReentry(null, NOW, null, null);
    expect(r.returning).toBe(false);
    expect(r.daysAway).toBe(0);
  });

  it("returning after 3 days shows warmth + state restore, never a gap (the criterion)", () => {
    const r = computeReentry(daysAgo(3), NOW, "I think spacing beats cramming.", "Why does retrieval help ADHD specifically?");
    expect(r.returning).toBe(true);
    expect(r.daysAway).toBe(3);
    expect(r.greeting.toLowerCase()).toContain("welcome back");
    expect(r.greeting).not.toMatch(BANNED);
    // state restore carries the human's last belief and the open question
    expect(r.lastBelief).toBe("I think spacing beats cramming.");
    expect(r.openQuestion).toBe("Why does retrieval help ADHD specifically?");
  });

  it("no absence length ever produces guilt copy", () => {
    for (const n of [1, 2, 3, 7, 14, 30, 90, 400]) {
      const r = computeReentry(daysAgo(n), NOW, null, null);
      expect(r.greeting, `daysAway=${n}`).not.toMatch(BANNED);
      expect(r.greeting.toLowerCase(), `daysAway=${n}`).toContain("welcome back");
    }
  });

  it("the 04:00 sieve-day boundary: a 1am return the next calendar day still counts a day away", () => {
    const lastNight = new Date("2026-07-23T20:00:00Z");
    const oneAmNext = new Date("2026-07-24T05:00:00Z"); // past 04:00 → new sieve day
    expect(computeReentry(lastNight, oneAmNext, null, null).returning).toBe(true);
  });
});

describe("oneNextTile — exactly one lit action, never a blank page (§6.3)", () => {
  it("due cards win: sends you to the Return", () => {
    const t = oneNextTile({ dueCards: 3, provisionalThreads: 2, unsortedCatches: 5, totalCatches: 10 });
    expect(t.href).toBe("/return");
  });
  it("no due cards but a provisional thread: sends you to name it", () => {
    const t = oneNextTile({ dueCards: 0, provisionalThreads: 1, unsortedCatches: 3, totalCatches: 10 });
    expect(t.href).toBe("/threads");
    expect(t.label.toLowerCase()).toContain("name");
  });
  it("nothing pending: invites a fresh catch (first vs subsequent)", () => {
    expect(oneNextTile({ dueCards: 0, provisionalThreads: 0, unsortedCatches: 0, totalCatches: 0 }).label.toLowerCase()).toContain("first");
    expect(oneNextTile({ dueCards: 0, provisionalThreads: 0, unsortedCatches: 0, totalCatches: 5 }).href).toBe("/");
  });
});
