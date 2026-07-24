import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ThreadsSync from "@/components/ThreadsSync";
import ThreadsView, {
  type ThreadLite,
  type CatchLite,
  type ProposalLite,
} from "@/components/ThreadsView";

export const dynamic = "force-dynamic";

interface CatchRow {
  id: string;
  raw_content: string;
  transcript: string | null;
  type: string;
  thread_id: string | null;
  source_meta: { title?: string } | null;
}
interface ThreadRow {
  id: string;
  name: string | null;
  name_provisional: boolean;
}

function title(c: CatchRow): string {
  if (c.type === "link" && c.source_meta?.title) return c.source_meta.title;
  return c.transcript || c.raw_content || "Untitled";
}

export default async function ThreadsPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: threads }, { data: catches }, { data: proposals }, { count: pending }] =
    await Promise.all([
      sb.from("threads").select("id, name, name_provisional").order("last_activity", {
        ascending: false,
      }),
      sb
        .from("catches")
        .select("id, raw_content, transcript, type, thread_id, source_meta")
        .eq("status", "sieved"),
      sb
        .from("merge_proposals")
        .select("id, thread_a, thread_b, similarity")
        .eq("status", "pending"),
      // catches that have synced but haven't finished sieving yet (invisible before)
      sb
        .from("catches")
        .select("id", { count: "exact", head: true })
        .neq("status", "sieved")
        .neq("status", "failed_extract"),
    ]);

  const nameById = new Map<string, string>(
    ((threads as ThreadRow[]) ?? []).map((t) => [t.id, t.name ?? "unnamed"]),
  );
  const provById = new Map<string, boolean>(
    ((threads as ThreadRow[]) ?? []).map((t) => [t.id, t.name_provisional]),
  );
  const byThread = new Map<string, CatchLite[]>();
  const inbox: CatchLite[] = [];
  for (const c of (catches as CatchRow[]) ?? []) {
    const lite = { id: c.id, title: title(c) };
    if (c.thread_id) {
      if (!byThread.has(c.thread_id)) byThread.set(c.thread_id, []);
      byThread.get(c.thread_id)!.push(lite);
    } else inbox.push(lite);
  }

  const threadList: ThreadLite[] = ((threads as ThreadRow[]) ?? [])
    .filter((t) => byThread.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      provisional: t.name_provisional,
      catches: byThread.get(t.id) ?? [],
    }));

  const proposalList: ProposalLite[] = ((proposals as
    | { id: string; thread_a: string; thread_b: string; similarity: number }[]
    | null) ?? []).map((p) => ({
    id: p.id,
    aName: nameById.get(p.thread_a) ?? "a thread",
    bName: nameById.get(p.thread_b) ?? "a thread",
    aProvisional: provById.get(p.thread_a) ?? true,
    bProvisional: provById.get(p.thread_b) ?? true,
    similarity: p.similarity,
  }));

  const empty = threadList.length === 0 && inbox.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl leading-tight text-ink">Your threads</h1>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
          {threadList.length} threads · {inbox.length} unsorted
          {pending ? ` · ${pending} still sieving` : ""}
        </span>
      </header>

      <ThreadsSync userId={user.id} />

      {empty ? (
        <div className="border-[3px] border-dashed border-ink/60 p-6">
          <p className="font-serif text-lg text-ink/80">
            Nothing sieved yet. Catch a few things and they&rsquo;ll gather themselves here.
          </p>
          <p className="mt-2 font-sans text-sm text-ink/70">
            You never file. The sieve does the sorting; you keep the judgment.
          </p>
        </div>
      ) : (
        <ThreadsView threads={threadList} inbox={inbox} proposals={proposalList} />
      )}
    </main>
  );
}
