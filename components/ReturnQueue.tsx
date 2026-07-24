"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface DueCard {
  id: string;
  question: string;
  reference: string;
  /** 0..1, days waited. Higher = riper (deeper accent). NEVER decays. */
  ripeness: number;
}

type Feel = "answered" | "easy" | "shaky";

/**
 * The Return queue — the Orchard (MASTER-PLAN §"El Vivero inverted"). Selva's
 * SRS garden wilts when due; §6 bans state that visually worsens through
 * inaction. So this INVERTS it: a due card is RIPE (deep acid band), an old due
 * card is just RIPER, and answering HARVESTS it into a permanent brick. There is
 * no rot, no red, no overdue badge, no guilt. The worst day is three taps: open,
 * one sentence, brick minted.
 *
 * Two voices (§ two-voice rule): the QUESTION is the machine speaking → mono.
 * The ANSWER is the human's material → serif. Counts and intervals → mono.
 */
export default function ReturnQueue({
  cards,
  brickCount,
}: {
  cards: DueCard[];
  brickCount: number;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<DueCard[]>(cards);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bricks, setBricks] = useState(brickCount);
  const [banked, setBanked] = useState(0); // bricks minted this session
  const [flash, setFlash] = useState<{ interval: number } | null>(null);

  const card = queue[0];

  async function harvest(feel: Feel) {
    if (!card || busy || answer.trim().length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/card/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, answer: answer.trim(), feel }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { intervalDays: number };
      // brick banked — lifetime count only ever goes UP (§ bricks are append-only)
      setBricks((b) => b + 1);
      setBanked((n) => n + 1);
      setFlash({ interval: json.intervalDays });
      setAnswer("");
      setQueue((q) => q.slice(1));
      // let the confirmation breathe, then clear
      setTimeout(() => setFlash(null), 2400);
      router.refresh();
    } catch {
      setFailed(true); // surface every failure — the answer is NOT lost, retry
    } finally {
      setBusy(false);
    }
  }

  // Empty: never a blank page, never a guilt wall (interface commandment).
  if (!card) {
    return (
      <section data-testid="return-empty" className="border-[3px] border-ink bg-ground p-6 shadow-hard">
        <p className="font-serif text-xl text-ink">
          {banked > 0 ? "That’s the Return." : "Nothing’s ripe just yet."}
        </p>
        <p className="mt-2 font-sans text-sm text-ink/70">
          {banked > 0
            ? "Your answers are banked. The sieve will bring more back as they ripen — come back tomorrow."
            : "Cards ripen on their own schedule. Catch a few more things, and the sieve will return them here when it’s time."}
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink/70">
          <span data-testid="brick-count">{bricks}</span> bricks
          {banked > 0 ? ` · +${banked} today` : ""}
        </p>
      </section>
    );
  }

  // ripeness → depth of the acid band (0.25..1 opacity). Riper = deeper. Never red.
  const bandOpacity = 0.25 + card.ripeness * 0.75;

  return (
    <div className="space-y-5">
      <section
        data-testid="return-card"
        className="overflow-hidden border-[3px] border-ink bg-ground shadow-hard-lg"
      >
        {/* the ripen band — glanceable SRS state, deepens with waiting, never wilts */}
        <div
          data-testid="ripen-band"
          className="h-2 w-full bg-accent"
          style={{ opacity: bandOpacity }}
          aria-hidden
        />
        <div className="p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink/60">
            on your catch
          </p>
          <p className="mb-4 font-sans text-sm italic text-ink/70">{card.reference}</p>

          {/* THE MACHINE ASKS — mono */}
          <p data-testid="card-question" className="mb-4 font-mono text-lg leading-snug text-ink">
            {card.question}
          </p>

          {/* THE HUMAN ANSWERS — serif, their own words */}
          <label htmlFor="answer" className="sr-only">
            Answer in your own words
          </label>
          <textarea
            id="answer"
            data-testid="answer-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            autoFocus
            placeholder="In your own words…"
            disabled={busy}
            className="w-full resize-y border-2 border-ink bg-ground p-3 font-serif text-lg text-ink outline-none placeholder:text-ink/40 focus:shadow-hard"
          />

          {failed && (
            <p data-testid="answer-error" role="alert" className="mt-2 font-mono text-sm text-ink">
              That didn’t send — your answer is still here. Try again.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              data-testid="harvest"
              onClick={() => harvest("answered")}
              disabled={busy || answer.trim().length === 0}
              className="border-2 border-ink bg-accent px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink shadow-hard disabled:opacity-40"
            >
              Answer &amp; bank a brick
            </button>
            {/* optional implicit-grading refinements — skippable, no calendar to manage */}
            <button
              data-testid="feel-easy"
              onClick={() => harvest("easy")}
              disabled={busy || answer.trim().length === 0}
              title="Came easily — see it again later"
              className="border-2 border-ink/50 bg-ground px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink/70 disabled:opacity-40"
            >
              that was easy
            </button>
            <button
              data-testid="feel-shaky"
              onClick={() => harvest("shaky")}
              disabled={busy || answer.trim().length === 0}
              title="Still shaky — bring it back sooner"
              className="border-2 border-ink/50 bg-ground px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink/70 disabled:opacity-40"
            >
              still shaky
            </button>
          </div>
        </div>
      </section>

      {flash && (
        <p data-testid="harvest-flash" className="font-mono text-sm text-ink">
          Brick banked. Back in{" "}
          {flash.interval === 0 ? "a moment" : `${flash.interval} day${flash.interval === 1 ? "" : "s"}`}.
        </p>
      )}

      <p className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
        <span data-testid="queue-remaining">{queue.length}</span> ripe ·{" "}
        <span data-testid="brick-count">{bricks}</span> bricks
        {banked > 0 ? ` · +${banked} today` : ""}
      </p>
    </div>
  );
}
