/**
 * Seeds the test user with fragmented same-topic threads, runs the threader,
 * then leaves them in place so the live /api/audit can be triggered against
 * them (naming + merge proposals). Run, then curl the audit, then inspect.
 */
import { createClient } from "@supabase/supabase-js";
import { embed, embeddableText, EMBEDDING_MODEL } from "../lib/sieve/embed";
import { randomUUID } from "node:crypto";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const USER = "00000000-0000-4000-8000-0000acce9701";

const TEXTS = [
  "spaced repetition dramatically improves memory retention for ADHD brains",
  "FSRS scheduling beats SM-2 for heterogeneous flashcards over months",
  "retrieval practice works at full magnitude for ADHD per Knouse 2016",
  "sear salmon skin-side down in a screaming hot cast iron pan",
  "let bread dough proof two hours until it doubles",
  "deglaze the pan with white wine to lift the fond for sauce",
  "the overnight sleeper train from Zurich to Vienna has private cabins",
  "Lisbon's tram 28 climbs through Alfama's narrow winding streets",
];

async function main() {
  await db.from("catches").delete().eq("user_id", USER);
  await db.from("threads").delete().eq("user_id", USER);
  await db.from("merge_proposals").delete().eq("user_id", USER);
  await db.from("profiles").upsert({ id: USER }, { onConflict: "id" });

  const base = Date.parse("2026-07-23T00:00:00Z");
  let i = 0;
  for (const t of TEXTS) {
    const e = await embed(embeddableText({ rawContent: t }));
    if (!e.ok) throw new Error(e.error);
    const id = randomUUID();
    await db.from("catches").insert({
      id,
      user_id: USER,
      type: "text",
      raw_content: t,
      source_meta: {},
      status: "sieved",
      embedding: JSON.stringify(e.embedding),
      embedding_model: EMBEDDING_MODEL,
      captured_at: new Date(base + i++ * 1000).toISOString(),
    });
    await db.rpc("assign_catch_to_thread", {
      p_catch_id: id,
      p_user_id: USER,
      p_embedding: JSON.stringify(e.embedding),
      p_model: EMBEDDING_MODEL,
      p_threshold: 0.72,
    });
  }
  const { count } = await db
    .from("threads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", USER);
  console.log(`seeded: ${TEXTS.length} catches → ${count} threads (test user ${USER})`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
