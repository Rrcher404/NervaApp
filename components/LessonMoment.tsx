"use client";

import { useSeenOnce } from "@/lib/useSeenOnce";

/**
 * The ONE embedded lesson moment v1 carries (MASTER-PLAN §7, a distilled unit
 * 2.1): the capture-flow question prompt, teaching the Question Formulation
 * Technique's Question Burst. This is the method made portable — a stranger can
 * learn the core move without the AI doing anything for them (§5: the AI is the
 * textbook). Guidance in the moment, never a 10-screen tour (§8): it appears once
 * after the first catch, is one tap to dismiss, and never returns to nag.
 */
export default function LessonMoment() {
  const [show, dismiss] = useSeenOnce("qft-lesson-seen");
  if (!show) return null;

  return (
    <aside data-testid="lesson-moment" className="mb-6 border-[3px] border-ink bg-ground p-5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
        a rep worth learning · the question burst
      </p>
      <h2 className="mt-1 font-serif text-xl text-ink">Don’t file it — interrogate it.</h2>
      <p className="mt-2 font-sans text-sm text-ink/80">
        The strongest thing you can do with a fresh catch is ask it questions — fast, before you
        judge. Four rules, from the Question Formulation Technique:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-ink/80">
        <li>Ask as many questions as you can.</li>
        <li>Don’t stop to answer, judge, or discuss them.</li>
        <li>Write every question down as it’s asked.</li>
        <li>Change any statement into a question.</li>
      </ul>
      <p className="mt-2 font-sans text-sm text-ink/70">
        The sieve hands a few back to you later, on the Return. Answering them in your own words is
        the whole method.
      </p>
      <button
        onClick={dismiss}
        data-testid="lesson-dismiss"
        className="mt-3 border-2 border-ink bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink"
      >
        Got it
      </button>
    </aside>
  );
}
