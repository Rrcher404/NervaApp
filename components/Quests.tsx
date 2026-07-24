import Link from "next/link";
import type { Quest } from "@/lib/quests";

/**
 * Rotating micro-quests from the user's own notes (§6.4). Each is a pointer to a
 * real epistemic action; tapping it goes there, where the action mints its own
 * brick. Unclaimed quests VANISH without residue — they aren't persisted as
 * obligations, so ignoring one leaves no mark, no guilt, no decay (§6). Novelty
 * comes from the user's material, not our content mill.
 */
export default function Quests({ quests }: { quests: Quest[] }) {
  return (
    <section data-testid="quests" className="mt-8">
      <h2 className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-ink/80">
        A few small things, from your own notes
      </h2>
      <ul className="space-y-3">
        {quests.map((q) => (
          <li key={q.id}>
            <Link
              href={q.href}
              data-testid="quest"
              className="group flex items-center justify-between gap-4 border-2 border-ink/60 bg-ground p-4 transition-colors hover:border-ink"
            >
              <span className="font-serif text-ink">{q.prompt}</span>
              <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-wide text-ink/70 group-hover:text-ink">
                {q.cta} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-sans text-xs text-ink/60">
        Skip any of them — they’re suggestions, and unclaimed ones simply pass. Tomorrow brings
        different ones.
      </p>
    </section>
  );
}
