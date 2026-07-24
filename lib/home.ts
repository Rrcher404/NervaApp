/**
 * Re-entry + One Next Tile (MASTER-PLAN §6.2/§6.3, §9 stage 4). The relapse
 * moment is where ND tools die, so absence is NEVER rendered as a gap: no "you
 * missed 3 days", no broken streak, no decay. Returning triggers the warmest
 * screen — welcome, a 30-second state restore (what you believed, the question
 * you left open), and exactly ONE lit micro-action. Silent infinite grace.
 *
 * Pure + deterministic (now injectable) so the acceptance test can assert the
 * warmth and the state-restore without a clock.
 */

/** Sieve-day boundary at 04:00 local (a 1am session belongs to yesterday). */
function sieveDayIndex(d: Date): number {
  return Math.floor((d.getTime() - 4 * 3_600_000) / 86_400_000);
}

export interface Reentry {
  returning: boolean;
  daysAway: number;
  /** warm, never a guilt wall — scales with absence but never scolds */
  greeting: string;
  lastBelief: string | null; // the human's last answer (serif)
  openQuestion: string | null; // the question they left (mono)
}

export function computeReentry(
  lastActivity: Date | null,
  now: Date,
  lastBelief: string | null,
  openQuestion: string | null,
): Reentry {
  // days away by sieve-day, so a late-night return doesn't over- or under-count
  const daysAway =
    lastActivity == null ? 0 : Math.max(0, sieveDayIndex(now) - sieveDayIndex(lastActivity));
  const returning = daysAway >= 1;

  // Absence is never surfaced as a number (§6). Warmth scales by band, but no
  // greeting ever counts the days — a count is the first inch of a guilt wall.
  let greeting: string;
  if (!returning) {
    greeting = "Welcome back.";
  } else if (daysAway === 1) {
    greeting = "Welcome back — right where you left it.";
  } else {
    greeting = "Welcome back. However long it’s been, your work kept its place.";
  }

  return { returning, daysAway, greeting, lastBelief, openQuestion };
}

export interface NextTile {
  label: string;
  sub: string;
  href: string;
}

export interface TileContext {
  dueCards: number;
  provisionalThreads: number;
  unsortedCatches: number;
  totalCatches: number;
}

/**
 * Exactly ONE lit next action, derived from real state (never a blank page). The
 * free-roam escape hatch is the nav, always visible — this is a suggestion, not a
 * gate. One tap from open to working.
 */
export function oneNextTile(ctx: TileContext): NextTile {
  if (ctx.dueCards > 0) {
    return {
      label: ctx.dueCards === 1 ? "Answer the card that’s ripe" : `Answer one of ${ctx.dueCards} ripe cards`,
      sub: "Two minutes, your own words. That’s the whole rep.",
      href: "/return",
    };
  }
  if (ctx.provisionalThreads > 0) {
    return {
      label: "Name a thread the sieve guessed at",
      sub: "The machine grouped them; you decide what they really are.",
      href: "/threads",
    };
  }
  if (ctx.unsortedCatches > 0) {
    return {
      label: "Glance at an unsorted catch",
      sub: "It finds a home the moment a second one agrees.",
      href: "/threads",
    };
  }
  return {
    label: ctx.totalCatches === 0 ? "Catch your first thing" : "Catch something new",
    sub: "A link, a thought, a voice memo. Pour it in — the sieve sorts it.",
    href: "/",
  };
}
