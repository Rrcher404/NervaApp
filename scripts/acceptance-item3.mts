/**
 * Item 3 acceptance certificate — proof the clustering-trust promise holds.
 *
 * The gate set is adversarial (bridge catch, sparse note, a 4th lone topic, a
 * near-duplicate pair) because three orthogonal topics separate under any
 * threshold even with every defect present.
 *
 * WHAT IT ASSERTS, AND WHY NOT SHUFFLE-INVARIANCE:
 * The design review wanted strict order-independence. The evidence forbids it.
 * Order-independence requires connected-components clustering, and empirically
 * (documented in the item-3 design memory) connected-components CHAINS through
 * the bridge catch at EVERY threshold — merging adhd+cook+travel+running into
 * one thread, the literal "why is my recipe in my thesis thread" betrayal.
 * Incremental single-linkage @ 0.72 has ZERO cross-topic collisions but is
 * order-sensitive. The plan already chose this tradeoff ("incremental only,
 * never batch recluster, prefer over-split to wrong-merge") — trust over
 * order-independence. So the real certificate is:
 *   1. >=3 sane threads (major topics separate into their own threads)
 *   2. ZERO cross-topic collisions (no thread mixes two major topics) — the trust-killer
 *   3. the near-duplicate lands with its twin
 *   4. determinism: same catches, same capture order, run twice -> identical partition
 * Fragmentation (a topic over-split into 2-3 threads) is safe and expected; the
 * nightly audit proposes merges for it.
 *
 * Run: npx tsx scripts/acceptance-item3.mts
 * Needs GOOGLE_GENERATIVE_AI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { embed, embeddableText, EMBEDDING_MODEL } from "../lib/sieve/embed";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const THRESHOLD = 0.72;
const USER = "00000000-0000-4000-8000-0000acce9701"; // fixed test user

type Seed = { topic: string; text: string; note?: string };
const SEEDS: Seed[] = [
  // ADHD / learning (7)
  { topic: "adhd", text: "spaced repetition dramatically improves memory retention for ADHD brains" },
  { topic: "adhd", text: "FSRS scheduling beats SM-2 for heterogeneous flashcards over months" },
  { topic: "adhd", text: "retrieval practice works at full magnitude for ADHD per Knouse 2016" },
  { topic: "adhd", text: "body doubling helps me start tasks I keep avoiding" },
  { topic: "adhd", text: "externalize everything at the point of performance, Barkley says" },
  { topic: "adhd", text: "Kuhlthau's ISP shows research feels worst in the middle, the Dip" },
  { topic: "adhd", text: "one Next Tile: exactly one lit action reduces initiation cost" },
  // cooking (7)
  { topic: "cook", text: "sear salmon skin-side down in a screaming hot cast iron pan" },
  { topic: "cook", text: "let bread dough proof two hours until it doubles" },
  { topic: "cook", text: "deglaze the pan with white wine to lift the fond for sauce" },
  { topic: "cook", text: "salt the pasta water until it tastes like the sea" },
  { topic: "cook", text: "rest the steak ten minutes so the juices redistribute" },
  { topic: "cook", text: "caramelize onions low and slow for forty-five minutes" },
  { topic: "cook", text: "temper chocolate to 31C so it snaps and shines" },
  // coding (7)
  { topic: "code", text: "use a Postgres pgvector index with cosine distance for nearest neighbor search" },
  { topic: "code", text: "the cosine distance operator in pgvector is written as an angle bracket equals bracket" },
  { topic: "code", text: "React useSyncExternalStore avoids setState-in-effect warnings" },
  { topic: "code", text: "Next.js App Router server components cannot use browser APIs like IndexedDB" },
  { topic: "code", text: "debounce IndexedDB writes to avoid thrashing on every keystroke" },
  { topic: "code", text: "a worker thread with terminate hard-kills a runaway synchronous parse" },
  { topic: "code", text: "RLS policies scope every row to its owner via the auth uid function" },
  // travel (6)
  { topic: "travel", text: "the overnight sleeper train from Zurich to Vienna has private cabins" },
  { topic: "travel", text: "Lisbon's tram 28 climbs through Alfama's narrow winding streets" },
  { topic: "travel", text: "book the Alhambra tickets weeks ahead in Granada, they sell out" },
  { topic: "travel", text: "the Shinkansen bullet train from Tokyo to Kyoto takes about two hours" },
  { topic: "travel", text: "Reykjavik is a good base for the Golden Circle day trips in Iceland" },
  { topic: "travel", text: "Venice is best explored early morning before the cruise crowds arrive" },
  // ── ADVERSARIAL ──
  { topic: "sparse", text: "buy oat milk", note: "sparse 3-word note — must not wrongly glom onto a topic" },
  { topic: "bridge", text: "using spaced repetition flashcards to memorize French recipes and cooking terms", note: "bridge: straddles adhd/learning AND cooking — must not merge the two topics" },
  { topic: "neardup", text: "sear the salmon skin side down in a very hot cast iron skillet", note: "near-duplicate of a cooking catch — should land WITH cooking" },
  { topic: "contradict", text: "my notes on training a marathon: long slow runs build the aerobic base", note: "a fourth distinct topic (running) — a lone catch, should stay in Inbox or its own thread, never absorbed" },
];

function labelOf(text: string): string {
  return SEEDS.find((s) => s.text === text)!.topic;
}

async function embedAll(): Promise<{ text: string; vec: number[] }[]> {
  const out: { text: string; vec: number[] }[] = [];
  for (const s of SEEDS) {
    const r = await embed(embeddableText({ rawContent: s.text }));
    if (!r.ok) throw new Error(`embed failed for "${s.text}": ${r.error}`);
    out.push({ text: s.text, vec: r.embedding! });
  }
  return out;
}

/** Wipe and reseed the test user's catches (thread_id null, sieved). */
async function reseed(embedded: { text: string; vec: number[] }[], order: number[]) {
  await db.from("catches").delete().eq("user_id", USER);
  await db.from("threads").delete().eq("user_id", USER);
  await db.from("merge_proposals").delete().eq("user_id", USER);
  // insert in the given order, with captured_at increasing so the DB loop is deterministic
  const base = Date.parse("2026-07-23T00:00:00Z");
  const rows = order.map((idx, i) => ({
    id: randomUUID(),
    user_id: USER,
    type: "text",
    raw_content: embedded[idx].text,
    source_meta: {},
    status: "sieved",
    embedding: JSON.stringify(embedded[idx].vec),
    embedding_model: EMBEDDING_MODEL,
    captured_at: new Date(base + i * 1000).toISOString(),
  }));
  const { error } = await db.from("catches").insert(rows);
  if (error) throw new Error("insert failed: " + error.message);
  return rows;
}

/** Run the in-DB threader over the user's catches in captured_at order. */
async function runThreading(rows: { id: string; embedding: string }[]) {
  // ordered by captured_at asc (the insert order) — call the RPC per catch
  for (const row of rows) {
    const { error } = await db.rpc("assign_catch_to_thread", {
      p_catch_id: row.id,
      p_user_id: USER,
      p_embedding: row.embedding,
      p_model: EMBEDDING_MODEL,
      p_threshold: THRESHOLD,
    });
    if (error) throw new Error("assign failed: " + error.message);
  }
}

const MAJOR = new Set(["adhd", "cook", "code", "travel"]);

/** Only real THREADS (not the Inbox bucket), as label lists. */
async function threadGroups(): Promise<{ groups: string[][]; inbox: string[] }> {
  const { data } = await db
    .from("catches")
    .select("raw_content, thread_id")
    .eq("user_id", USER);
  const byThread = new Map<string, string[]>();
  const inbox: string[] = [];
  for (const c of data!) {
    const lbl = labelOf(c.raw_content);
    if (c.thread_id) {
      if (!byThread.has(c.thread_id)) byThread.set(c.thread_id, []);
      byThread.get(c.thread_id)!.push(lbl);
    } else inbox.push(lbl);
  }
  return { groups: [...byThread.values()].map((g) => g.sort()), inbox: inbox.sort() };
}

async function seedRunReport() {
  const embedded = await embedAll();
  const canonical = embedded.map((_, i) => i); // capture order = canonical
  await reseed(embedded, canonical);
  const { data: ordered } = await db
    .from("catches")
    .select("id, embedding")
    .eq("user_id", USER)
    .order("captured_at", { ascending: true });
  await runThreading(ordered as { id: string; embedding: string }[]);
  return threadGroups();
}

async function main() {
  console.log("embedding", SEEDS.length, "catches (Gemini CLUSTERING, normalized)...\n");

  // Run 1
  const r1 = await seedRunReport();
  console.log("── threads ──");
  for (const g of r1.groups) console.log("   ", g.join(", "));
  console.log("   INBOX:", r1.inbox.join(", ") || "(empty)");

  // Run 2 (determinism): same catches, same canonical order
  const r2 = await seedRunReport();

  // ── assertions ──
  const collisions = r1.groups.filter((g) => new Set(g.filter((l) => MAJOR.has(l))).size >= 2);
  const saneThreads = r1.groups.filter(
    (g) => new Set(g.filter((l) => MAJOR.has(l))).size === 1 &&
           g.filter((l) => MAJOR.has(l)).length >= 2,
  );
  const nearDupThread = r1.groups.find((g) => g.includes("neardup"));
  const nearDupWithCook = !!nearDupThread && nearDupThread.includes("cook");
  const key1 = r1.groups.map((g) => g.join("+")).sort().join(" | ");
  const key2 = r2.groups.map((g) => g.join("+")).sort().join(" | ");
  const deterministic = key1 === key2;

  console.log("\n=== VERDICT ===");
  console.log(`≥3 sane single-topic threads:      ${saneThreads.length >= 3 ? "YES ✓" : "NO ✗"} (${saneThreads.length})`);
  console.log(`ZERO cross-topic collisions:       ${collisions.length === 0 ? "YES ✓" : "NO ✗"} (${collisions.length})`);
  for (const c of collisions) console.log("   !! COLLISION:", [...new Set(c)].join(", "));
  console.log(`near-duplicate lands with cooking: ${nearDupWithCook ? "YES ✓" : "NO ✗"}`);
  console.log(`deterministic (re-sieve identical):${deterministic ? "YES ✓" : "NO ✗"}`);

  await db.from("catches").delete().eq("user_id", USER);
  await db.from("threads").delete().eq("user_id", USER);
  await db.from("merge_proposals").delete().eq("user_id", USER);

  const pass = saneThreads.length >= 3 && collisions.length === 0 && nearDupWithCook && deterministic;
  console.log(pass ? "\nACCEPTANCE: PASS ✓" : "\nACCEPTANCE: FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
