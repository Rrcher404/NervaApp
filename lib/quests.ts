/**
 * Quests (MASTER-PLAN §6.4; CLAUDE.md lib/quests.ts) — rotating micro-quests
 * generated from the USER'S OWN notes, not our content mill. Deterministic and
 * date-seeded: the same state on the same "sieve day" yields the same quests, and
 * they rotate when the day turns. Unclaimed quests VANISH without penalty or
 * residue — nothing is persisted as an obligation, so a skipped quest leaves no
 * mark (§6: no guilt, no decay). Each quest is a pointer to a real epistemic
 * action the human takes elsewhere; doing that action mints its own brick.
 *
 * The day boundary is 04:00 local (CLAUDE.md): a 1am session belongs to yesterday.
 */

export interface QuestContext {
  dueCards: number;
  unsortedCatches: number;
  provisionalThreads: { id: string; name: string }[];
  lonelyThreads: { id: string; name: string }[]; // threads with a single catch
  recentCatch?: { id: string; title: string };
}

export interface Quest {
  id: string; // stable within a sieve-day for the same kind+target
  kind: string;
  prompt: string;
  href: string;
  cta: string;
}

/** The sieve-day key (local date with a 04:00 boundary) — the rotation clock. */
export function sieveDayKey(now: Date): string {
  const shifted = new Date(now.getTime() - 4 * 3_600_000); // 04:00 belongs to the new day
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

/** Small deterministic hash (FNV-1a-ish) → 32-bit unsigned. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded shuffle (deterministic) so the day's selection is stable but rotates. */
function seededOrder<T>(items: T[], seed: number): T[] {
  return items
    .map((item, i) => ({ item, k: hash(`${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}

/**
 * Generate up to `max` quests from the user's current corpus, deterministic for
 * (userId, sieveDay, state). Only conditions that actually hold produce a quest,
 * so a quest is never busywork invented from nothing.
 */
export function generateQuests(
  ctx: QuestContext,
  userId: string,
  now: Date,
  max = 3,
): Quest[] {
  const day = sieveDayKey(now);
  const seed = hash(`${userId}:${day}`);
  const candidates: Quest[] = [];

  if (ctx.dueCards > 0) {
    candidates.push({
      id: `answer:${day}`,
      kind: "answer_due",
      prompt:
        ctx.dueCards === 1
          ? "One card is ripe on the Return — answer it in your own words."
          : `${ctx.dueCards} cards are ripe — answer just one.`,
      href: "/return",
      cta: "Open the Return",
    });
  }

  for (const t of ctx.provisionalThreads) {
    candidates.push({
      id: `name:${t.id}:${day}`,
      kind: "name_thread",
      prompt: `The sieve is calling a thread “${t.name}”. Is that what it really is? Rename it.`,
      href: "/threads",
      cta: "Name the thread",
    });
  }

  for (const t of ctx.lonelyThreads) {
    candidates.push({
      id: `companion:${t.id}:${day}`,
      kind: "lonely_thread",
      prompt: `“${t.name}” has just one catch. Catch something that argues with it, or agrees.`,
      href: "/",
      cta: "Catch a companion",
    });
  }

  if (ctx.unsortedCatches > 0) {
    candidates.push({
      id: `file:${day}`,
      kind: "file_inbox",
      prompt:
        ctx.unsortedCatches === 1
          ? "One catch is still unsorted — it finds a home when a second one agrees."
          : `${ctx.unsortedCatches} catches are unsorted — glance at one and see where it belongs.`,
      href: "/threads",
      cta: "Look at Unsorted",
    });
  }

  if (ctx.recentCatch) {
    candidates.push({
      id: `revisit:${ctx.recentCatch.id}:${day}`,
      kind: "revisit",
      prompt: `You caught “${ctx.recentCatch.title}”. Turn it over — what question does it raise?`,
      href: "/",
      cta: "Ask it a question",
    });
  }

  return seededOrder(candidates, seed).slice(0, max);
}
