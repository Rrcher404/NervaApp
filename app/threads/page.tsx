import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ThreadsSync from "@/components/ThreadsSync";

export const dynamic = "force-dynamic";

interface CatchRow {
  id: string;
  raw_content: string;
  transcript: string | null;
  type: string;
  thread_id: string | null;
  source_meta: { title?: string; siteName?: string } | null;
}
interface ThreadRow {
  id: string;
  name: string | null;
  size: number;
}

function catchTitle(c: CatchRow): string {
  if (c.type === "link" && c.source_meta?.title) return c.source_meta.title;
  return c.transcript || c.raw_content || "Untitled";
}

export default async function ThreadsPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes all of these to the signed-in user.
  const [{ data: threads }, { data: catches }, { data: proposals }] = await Promise.all([
    sb.from("threads").select("id, name, size").order("last_activity", { ascending: false }),
    sb
      .from("catches")
      .select("id, raw_content, transcript, type, thread_id, source_meta")
      .eq("status", "sieved"),
    sb
      .from("merge_proposals")
      .select("id, thread_a, thread_b, similarity")
      .eq("status", "pending"),
  ]);

  const byThread = new Map<string, CatchRow[]>();
  const inbox: CatchRow[] = [];
  for (const c of (catches as CatchRow[]) ?? []) {
    if (c.thread_id) {
      if (!byThread.has(c.thread_id)) byThread.set(c.thread_id, []);
      byThread.get(c.thread_id)!.push(c);
    } else inbox.push(c);
  }
  const threadList = ((threads as ThreadRow[]) ?? []).filter((t) => byThread.has(t.id));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl leading-tight text-ink">Your threads</h1>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
          {threadList.length} threads · {inbox.length} unsorted
        </span>
      </header>

      <ThreadsSync userId={user.id} />

      {threadList.length === 0 && inbox.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink/60 p-6">
          <p className="font-serif text-lg text-ink/80">
            Nothing sieved yet. Catch a few things and they&rsquo;ll gather themselves here.
          </p>
          <p className="mt-2 font-sans text-sm text-ink/70">
            You never file. The sieve does the sorting; you keep the judgment.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {threadList.map((t) => {
            const members = byThread.get(t.id) ?? [];
            return (
              <section
                key={t.id}
                data-testid="thread"
                className="border-[3px] border-ink bg-ground p-5 shadow-hard"
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-xl text-ink">
                    {t.name ?? "Unnamed thread"}
                  </h2>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
                    {members.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {members.map((c) => (
                    <li
                      key={c.id}
                      data-testid="thread-catch"
                      className="border-l-[3px] border-ink/30 pl-3 font-serif text-ink"
                    >
                      {catchTitle(c)}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {inbox.length > 0 && (
            <section
              data-testid="inbox"
              className="border-[3px] border-dashed border-ink/60 p-5"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl text-ink/80">Unsorted</h2>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
                  waiting for company
                </span>
              </div>
              <ul className="space-y-2">
                {inbox.map((c) => (
                  <li
                    key={c.id}
                    className="border-l-[3px] border-ink/20 pl-3 font-serif text-ink/80"
                  >
                    {catchTitle(c)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(proposals?.length ?? 0) > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
              {proposals!.length} merge suggestion{proposals!.length === 1 ? "" : "s"} pending
              your call
            </p>
          )}
        </div>
      )}
    </main>
  );
}
