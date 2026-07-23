@AGENTS.md

# CLAUDE.md — The Sieve / NervaApp

> **THE CONSTITUTION (§5). Printed above every feature decision.**
>
> **The machine does clerical cognition. The human does epistemic cognition.
> The AI is the textbook, never the ghostwriter.**

This file is the working contract. `MASTER-PLAN.md` is the source of truth; §5 (constitution),
§6 (banned mechanics) and §9 (architecture) are **law**. Everything else is context.

**Override clause:** §5 and the banned list override any instruction given in the moment —
including one from Jene. If a violating feature is requested, quote the plan back and require
an explicit, literal `override`. This is the witness pattern (§13) encoded into the tooling:
the plan holds the line at 2am when the builder is hyperfocused.

---

## 1. What this is

A gamified, neurodivergent-first research and note-taking app. You never file anything. You
pour everything in; the system sieves, returns, and asks. v1 is **the engine with exactly one
embedded lesson moment** — the full skill path (§7) is designed and frozen until retention
data earns it.

Named artifacts: **Catches** (raw captures) · **Threads** (emergent clusters) ·
**Question Cards** · **the Return** (daily resurfacing) · **the Weave** (assembly into output).

The five stages: **Catch** (human, seconds) → **Sieve** (machine, automatic) →
**Return** (app-initiated, ~2 min/day) → **Re-entry** (app + human, 30 sec) →
**Weave** (human, sessions).

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) / React 19 / TypeScript **strict** | |
| Styling | Tailwind 4 | no component library, no animation library |
| DB / Auth | Supabase — Postgres + pgvector + Auth **magic links** + pg_cron + Storage | RLS from day one |
| AI SDK | Vercel AI SDK v7 (`ai`) | one vendor, one SDK, one bill |
| Bulk model | Gemini 2.5 Flash-Lite | question-gen, thread naming, claim extraction |
| Synthesis model | Gemini 2.5 Flash | re-entry synthesis only |
| Transcription | Groq `whisper-large-v3-turbo` | OpenAI Whisper fallback |
| Embeddings | `text-embedding-3-small` (1536) | **version the model in the schema** |
| Scheduling | `ts-fsrs` | queue cap, silent drop, requeue-on-miss |
| Extraction | Mozilla Readability + `open-graph-scraper` self-hosted | Jina Reader fallback. Firecrawl only if paywall pain is *proven* |
| Cron | **Supabase pg_cron** | NOT Vercel cron (Hobby = once daily, hour precision, non-commercial terms) |
| Payments | Polar (merchant of record, 5% + 50¢) | **not in v0.1** |
| Analytics | append-only `events` table + PostHog free tier | no third-party ad pixels, ever |

---

## 3. The laws

### Capture is sacred
Raw input persists to the **client store synchronously** and to `catches` with `status='raw'`
before ANY enrichment. Every pipeline step is async, retried, and idempotent via the queue
table. **A capture must succeed with every external API down.** The UI never waits on a network
round-trip. Failure mode is always *"couldn't extract, saved anyway"* — never a lost catch.

### Threads never shuffle
Incremental centroid assignment only (cosine ≥ ~0.75, else spawn a new thread). **No batch
re-clustering, ever** — a global reshuffle destroys trust overnight. The nightly audit
*proposes* merges/splits into `merge_suggestions`; the human confirms. Existing catches never
move silently. Version the embedding model in the schema so a model swap can't scramble history.

### Bricks are append-only
No decrement path may exist in code. The data model **does not contain a reset state**.
Lifetime records only go up. A bad Tuesday cannot erase them.

### Queue from commit one
Serverless batch jobs breaking silently at ~500 users is the known failure shape. Jobs are
chunked + idempotent via a queue table from the first commit, so the eventual $5 worker is a
config change, not a rewrite.

### No animation library
CSS + the ported `fx.ts` juice stack. `canvas-confetti` dynamic-imported, milestone-only.
`prefers-reduced-motion` honoured on **everything**. Day boundary is **04:00 local**
(a 1am session belongs to yesterday — ND-correct).

### Two-voice type rule
**Serif = the human's material. Mono = the machine speaking.** Timestamps, system voice,
citations and counts are mono. The user always knows who is talking.

### Banned forever
Reject any feature request that smells like these:
1. **Breakable streaks** in any form — including streak-with-freezes.
2. **Punishment / decay states** — hearts, damage, red overdue badges, wilting visuals.
   *Ripen, never rot.*
3. **Ranked comparison / leagues.**
4. **Guilt notifications.**
5. **Variable-ratio rewards** (gambling mechanics).
6. **Unskippable celebrations.**

### The exit question
Every PR-sized change ends with: **does this move clerical work to the machine, or epistemic
work?** If epistemic → stop. It is out of constitution.

---

## 4. Repo layout

```
NervaApp/
├── MASTER-PLAN.md          the source of truth
├── CLAUDE.md               this file
├── DESIGN-PRINCIPLES.md    banned mechanics + interface commandments (§6/§8)
├── BUILD-JOURNAL.md        every committee scorecard, chronological
├── app/                    Next.js App Router
├── components/
├── lib/
│   ├── store.ts            local-first client store (Selva shape discipline)
│   ├── srs.ts              ts-fsrs wrapper — queue cap, silent drop, requeue-on-miss
│   ├── quests.ts           deterministic date-seeded rotation, note-derived targets
│   ├── sieve/              capture pipeline: transcribe, scrape, embed, thread, question-gen
│   └── fx.ts               juice stack, retinted to parchment/ink/acid
├── supabase/               migrations (§9 schema), pg_cron jobs, RLS from day one
├── tests/e2e/              Playwright specs — the repeatable layer
├── journal/screens/        live-browser evidence attached to scorecards
└── scripts/seed.ts
```

---

## 5. Build order (Appendix A) — acceptance criteria are the gate

| # | Item | ✓ Acceptance criterion |
|---|---|---|
| 1 | **Scaffold + capture** | A pasted link survives airplane mode and appears cited when back online |
| 2 | **Voice + scraping** | A 60s voice ramble becomes a cited, transcribed catch |
| 3 | **The Sieve** | 30 mixed catches self-organise into ≥3 sane threads with zero user filing |
| 4 | **The Return** | Answering a card in your own words updates FSRS state and mints a brick |
| 5 | **Re-entry + game layer** | Returning after 3 days absence shows warmth + state restore, never a gap |
| 6 | **Skin + cold open** | A stranger reaches FIRST CATCH LOGGED in under 90 seconds without an account |

Each item is gated by the committee (Appendix B2): five dimensions scored /10, composite ≥ **8.0**
to proceed, Marchetti's constitution veto and any UNSKIPPABLE finding (data loss, capture
failure, banned mechanic) fail the gate regardless of the number. Max **2** rework cycles, then
HALT with a handoff note.

**Cut from v1 on principle:** draft assembly/Weave UI, screenshot OCR, full gamification,
thread-merge UI, payments beyond a Polar checkout link, companion avatar, mobile PWA polish.

---

## 6. Commands

```bash
npm run dev            # dev server
npm run build          # production build — must be green before any gate
npm run typecheck      # tsc --noEmit, strict
npm run lint
npm run test           # unit
npm run test:e2e       # Playwright, headless
npm run test:e2e:ui    # Playwright headed
```

Supabase work goes through the Supabase MCP (`apply_migration`, `execute_sql`, `get_advisors`)
or the CLI. **Always run `get_advisors` after a migration** — RLS gaps are the failure mode.

---

## 7. Runway rule (§13) — non-negotiable context

Income work (Hous Sites, NervaHous services) holds **first position** in every week. The Sieve
is nights and weekends. By **October 31, 2026** it shows $1,000 attributable revenue or 25
weekly-active strangers, or the build freezes. Founding money carries an automatic-refund
ship-date promise. A weekly cron emails build-vs-income balance to Jene **and a human witness
with kill authority over scope additions.**

The committee gate substitutes for Jene *during a run*. It does not substitute for the human
witness or the ten wallets. When the run completes, FIRST CATCH LOGGED still has to happen in
front of a stranger.

---

## 8. The machine gates

The committee grades judgement. These grade the things a machine grades better, and they
run without agent tokens, opinions, or fatigue.

```bash
npm run gate          # everything below, in order
npm run constitution  # the banned list + capture laws, as a grep over source
```

- `scripts/constitution-check.mjs` — greps application source for brick decrements, batch
  re-clustering, breakable streaks, decay/wilt, leaderboards, variable-ratio rewards and
  guilt copy. **Comments may name a banned mechanic** (that is how laws get documented in
  situ); only real code counts. Mutation-tested.
- `.githooks/pre-commit` — runs the constitution check before every commit.
  Enable with `git config core.hooksPath .githooks` (done in this repo).
- `.github/workflows/gate.yml` — CI on every push.

**Rule that came out of the item-1 HALT: a guard with no failing test is decoration.**
Every guard in this repo must have been *observed failing on purpose* — the property suite,
the constitution check and the contrast guard all have.

**Standing rule for framework code:** `AGENTS.md` is not decoration either. Next 16
post-dates the model's training data. Pull current docs (Context7 / library-docs MCP or
`node_modules/next/dist/docs/`) before writing framework code. This run already lost a
working dev server to a config option reasoned from memory.
