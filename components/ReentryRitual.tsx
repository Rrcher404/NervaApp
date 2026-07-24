"use client";

import { useState } from "react";
import type { Reentry } from "@/lib/home";

/**
 * The return ritual (MASTER-PLAN §6.2) — the most polished screen in the product,
 * because the relapse moment is where every ND tool dies. Absence is NEVER a gap:
 * no missed-days counter, no broken streak, no decay, no guilt. Just warmth, a
 * 30-second state restore (what you believed, the question you left), and the
 * bricks that only ever went up. Once acknowledged it collapses for the day so it
 * greets, never nags.
 *
 * Two voices: the warm headline is serif (the app's system voice, hospitable);
 * the machine's facts — the restore labels, the counts — are mono; the human's
 * own last words (their belief) are serif, their material.
 */
export default function ReentryRitual({
  reentry,
  brickCount,
}: {
  reentry: Reentry;
  brickCount: number;
}) {
  // Server-rendered and visible on return (this is the warmest, must-be-immediate
  // screen). Acknowledging collapses it to the quiet header for this view — warm
  // on return, never a nag.
  const [ack, setAck] = useState(false);
  const acknowledge = () => setAck(true);

  // Not returning (a same-day open): a quiet, warm header — never empty, never loud.
  if (!reentry.returning || ack) {
    return (
      <header className="flex items-baseline justify-between gap-4 border-b-[3px] border-ink pb-4">
        <h1 className="font-serif text-3xl leading-tight text-ink">
          {reentry.returning ? "Good to see you again." : "Welcome back."}
        </h1>
        <span data-testid="brick-count" className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
          {brickCount} brick{brickCount === 1 ? "" : "s"}
        </span>
      </header>
    );
  }

  // The full return ritual.
  return (
    <section
      data-testid="reentry-ritual"
      className="border-[3px] border-ink bg-ground p-6 shadow-hard-lg"
    >
      <h1 data-testid="reentry-greeting" className="font-serif text-3xl leading-tight text-ink">
        {reentry.greeting}
      </h1>

      <div className="mt-5 space-y-4">
        {reentry.lastBelief && (
          <div data-testid="last-belief">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
              last time, in your words
            </p>
            <p className="mt-1 border-l-[3px] border-accent pl-3 font-serif text-lg text-ink">
              {reentry.lastBelief}
            </p>
          </div>
        )}

        {reentry.openQuestion && (
          <div data-testid="open-question">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
              the question you left open
            </p>
            <p className="mt-1 font-mono text-base text-ink">{reentry.openQuestion}</p>
          </div>
        )}

        {!reentry.lastBelief && !reentry.openQuestion && (
          <p className="font-sans text-sm text-ink/70">
            Everything you poured in is still here, sorted and waiting. Pick one small thing below.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
          {brickCount} brick{brickCount === 1 ? "" : "s"} — and counting only up
        </span>
        <button
          data-testid="reentry-ack"
          onClick={acknowledge}
          className="border-2 border-ink bg-accent px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink shadow-hard"
        >
          Pick up where I left off
        </button>
      </div>
    </section>
  );
}
