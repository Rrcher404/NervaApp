import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { computeReentry, oneNextTile } from "@/lib/home";
import { generateQuests, type QuestContext } from "@/lib/quests";
import ReentryRitual from "@/components/ReentryRitual";
import Quests from "@/components/Quests";

export const dynamic = "force-dynamic";

interface CatchRow {
  id: string;
  thread_id: string | null;
  status: string;
  captured_at: string;
  type: string;
  source_meta: { title?: string } | null;
  transcript: string | null;
  raw_content: string | null;
}
interface ThreadRow { id: string; name: string | null; name_provisional: boolean }
interface AnsweredRow { user_answer: string | null; answer_history: { at?: string }[] }

function catchTitle(c: CatchRow): string {
  if (c.type === "link" && c.source_meta?.title) return c.source_meta.title;
  const body = c.transcript || c.raw_content || "";
  return body.length > 70 ? body.slice(0, 70).trimEnd() + "…" : body || "a catch";
}

export default async function HomePage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const renderedAt = new Date();
  const nowISO = renderedAt.toISOString();

  const [
    { data: catches },
    { data: threads },
    { data: answered },
    { data: dueCards, count: dueCount },
    { count: brickCount },
    { data: lastBrick },
  ] = await Promise.all([
    sb.from("catches").select("id, thread_id, status, captured_at, type, source_meta, transcript, raw_content"),
    sb.from("threads").select("id, name, name_provisional"),
    sb.from("question_cards").select("user_answer, answer_history").not("user_answer", "is", null),
    sb.from("question_cards").select("question", { count: "exact" }).lte("due_at", nowISO).order("due_at", { ascending: true }).limit(1),
    sb.from("bricks").select("id", { count: "exact", head: true }),
    sb.from("bricks").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const catchRows = (catches as CatchRow[] | null) ?? [];
  const threadRows = (threads as ThreadRow[] | null) ?? [];
  const answeredRows = (answered as AnsweredRow[] | null) ?? [];

  // last activity = the latest meaningful trace: a catch, or any brick (catch/answer/quest)
  const times: number[] = [];
  for (const c of catchRows) times.push(new Date(c.captured_at).getTime());
  if (lastBrick?.[0]?.created_at) times.push(new Date(lastBrick[0].created_at).getTime());
  const lastActivity = times.length ? new Date(Math.max(...times)) : null;

  // last belief = the most recently answered card's answer (by answer_history time)
  let lastBelief: string | null = null;
  let latestAns = 0;
  for (const a of answeredRows) {
    const at = a.answer_history?.length ? Date.parse(a.answer_history[a.answer_history.length - 1]?.at ?? "") : 0;
    if (a.user_answer && at >= latestAns) {
      latestAns = at;
      lastBelief = a.user_answer;
    }
  }

  const openQuestion = (dueCards as { question: string }[] | null)?.[0]?.question ?? null;
  const reentry = computeReentry(lastActivity, renderedAt, lastBelief, openQuestion);

  // context for the tile + quests
  const sieved = catchRows.filter((c) => c.status === "sieved");
  const unsorted = sieved.filter((c) => !c.thread_id);
  const provisional = threadRows.filter((t) => t.name_provisional);
  const perThread = new Map<string, number>();
  for (const c of sieved) if (c.thread_id) perThread.set(c.thread_id, (perThread.get(c.thread_id) ?? 0) + 1);
  const lonely = threadRows.filter((t) => perThread.get(t.id) === 1);
  const recent = [...catchRows].sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];

  const tile = oneNextTile({
    dueCards: dueCount ?? 0,
    provisionalThreads: provisional.length,
    unsortedCatches: unsorted.length,
    totalCatches: catchRows.length,
  });

  const questCtx: QuestContext = {
    dueCards: dueCount ?? 0,
    unsortedCatches: unsorted.length,
    provisionalThreads: provisional.map((t) => ({ id: t.id, name: t.name ?? "unnamed" })),
    lonelyThreads: lonely.map((t) => ({ id: t.id, name: t.name ?? "unnamed" })),
    recentCatch: recent ? { id: recent.id, title: catchTitle(recent) } : undefined,
  };
  const quests = generateQuests(questCtx, user.id, renderedAt);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <ReentryRitual reentry={reentry} brickCount={brickCount ?? 0} />

      {/* One Next Tile — the single lit action */}
      <Link
        href={tile.href}
        data-testid="next-tile"
        className="mt-6 block border-[3px] border-ink bg-accent p-6 shadow-hard-lg transition-transform hover:-translate-y-0.5"
      >
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink/70">your one next thing</p>
        <p className="mt-1 font-serif text-2xl leading-tight text-ink">{tile.label}</p>
        <p className="mt-1 font-sans text-sm text-ink/80">{tile.sub}</p>
      </Link>

      {quests.length > 0 && <Quests quests={quests} />}

      {/* the free-roam escape hatch is always the nav — this is a suggestion, not a gate */}
      <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-ink/60">
        or wander — Catch, Threads, and the Return are one tap up top.
      </p>
    </main>
  );
}
