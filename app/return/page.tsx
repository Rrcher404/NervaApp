import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ReturnQueue, { type DueCard } from "@/components/ReturnQueue";
import { RETURN_QUEUE_CAP } from "@/lib/srs";

export const dynamic = "force-dynamic";

interface CardRow {
  id: string;
  question: string;
  due_at: string;
  catches: {
    raw_content: string | null;
    transcript: string | null;
    source_meta: { title?: string } | null;
    type: string;
  } | null;
}

/** A short reminder of WHICH catch this asks about — never the answer. */
function reference(c: CardRow["catches"]): string {
  if (!c) return "one of your catches";
  if (c.type === "link" && c.source_meta?.title) return c.source_meta.title;
  const body = c.transcript || c.raw_content || "";
  return body.length > 90 ? body.slice(0, 90).trimEnd() + "…" : body || "one of your catches";
}

export default async function ReturnPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // force-dynamic server render: "now" is intentionally read at request time so
  // the Return shows what is due right now. One read, reused for query + ripeness.
  const renderedAt = new Date();
  const nowISO = renderedAt.toISOString();
  const [{ data: cards }, { count: brickCount }, { count: totalDue }] = await Promise.all([
    sb
      .from("question_cards")
      .select("id, question, due_at, catches(raw_content, transcript, source_meta, type)")
      .lte("due_at", nowISO)
      .order("due_at", { ascending: true })
      .limit(RETURN_QUEUE_CAP),
    sb.from("bricks").select("id", { count: "exact", head: true }),
    sb.from("question_cards").select("id", { count: "exact", head: true }).lte("due_at", nowISO),
  ]);

  const now = renderedAt.getTime();
  const list: DueCard[] = ((cards as CardRow[] | null) ?? []).map((c) => ({
    id: c.id,
    question: c.question,
    reference: reference(c.catches),
    // ripeness 0..1 by days waited (caps ~14d). Overdue just gets RIPER, never rots.
    ripeness: Math.min(1, Math.max(0, (now - new Date(c.due_at).getTime()) / (14 * 86_400_000))),
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl leading-tight text-ink">The Return</h1>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
          {list.length} ripe{(totalDue ?? 0) > list.length ? ` · ${totalDue} due` : ""}
        </span>
      </header>

      <ReturnQueue cards={list} brickCount={brickCount ?? 0} />
    </main>
  );
}
