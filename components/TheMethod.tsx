/**
 * The method, made portable (MASTER-PLAN §5 "the AI is the textbook"; the
 * guidance-layer request, kept v1-LIGHTWEIGHT — the full skill library stays
 * frozen with §7). A static, non-AI panel: a stranger can learn how to use the
 * Sieve, and the research moves behind it, without the AI doing anything for them.
 *
 * Collapsed by default (native <details>, zero JS, zero cost to the 90-second cold
 * open) and it never nags — it's there when curiosity strikes, invisible otherwise.
 */

const STAGES = [
  ["Catch", "Pour anything in — a link, a thought, a voice memo. Seconds, zero decisions."],
  ["Sieve", "The machine reads, files, and groups it into threads. You never file anything."],
  ["Return", "A few questions about your own catches come back, spaced. Answer in your words."],
  ["Re-entry", "Come back after any gap to warmth and a state restore — never a blank page."],
  ["Weave", "When it’s time to write, your answered questions are already the outline."],
] as const;

const MOVES = [
  ["Explore a question", "What don’t I understand yet about ______? What would change my mind?"],
  ["Referee a disagreement", "Source A says ______; source B says ______. What would settle it?"],
  ["Trace a claim", "Where did “______” actually come from, and does the original say that?"],
] as const;

const WHY = [
  ["Retrieval practice", "Pulling an idea back from memory beats re-reading — and for ADHD it works at full strength (Knouse et al. 2016)."],
  ["Spaced repetition", "Questions return on a widening schedule you never have to manage (FSRS)."],
  ["The Question Burst", "Asking fast without judging turns a scrap into something you’ll actually think about (Question Formulation Technique)."],
  ["Lateral reading", "To judge a source, leave the page and check what others say (SIFT / Caulfield)."],
] as const;

export default function TheMethod() {
  return (
    <details data-testid="the-method" className="mt-10 border-[3px] border-ink bg-ground">
      <summary className="cursor-pointer list-none p-4 font-mono text-sm font-bold uppercase tracking-wider text-ink">
        How the Sieve works ▾
      </summary>
      <div className="space-y-6 border-t-[3px] border-ink p-5">
        <section>
          <h3 className="mb-2 font-serif text-xl text-ink">The five stages</h3>
          <ol className="space-y-2">
            {STAGES.map(([name, desc]) => (
              <li key={name} className="flex gap-3">
                <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-wide text-ink/70">
                  {name}
                </span>
                <span className="font-sans text-sm text-ink/80">{desc}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-xl text-ink">Stuck on what to catch? Try a move</h3>
          <ul className="space-y-3">
            {MOVES.map(([name, starter]) => (
              <li key={name}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/70">{name}</p>
                <p className="mt-0.5 font-serif text-ink/90">“{starter}”</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-xs text-ink/60">
            Fill in the blanks and paste it up top — the sieve does the rest.
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-xl text-ink">Why it works</h3>
          <ul className="space-y-2">
            {WHY.map(([name, fact]) => (
              <li key={name} className="font-sans text-sm text-ink/80">
                <span className="font-semibold text-ink">{name}. </span>
                {fact}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
