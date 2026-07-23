# THE SIEVE
### Master plan — a gamified, neurodivergent-first research & note-taking app
**Date:** 2026-07-23 · **Owner:** Jene Maybury · **Repo:** [github.com/Rrcher404/NervaApp](https://github.com/Rrcher404/NervaApp) (already created — this plan lives there) · **Status:** Synthesized, ready for the go/no-go gate in §2

🎭 **CAST:** Adeyemi-Strand (landscape) · Kowalczyk (gamification/momentum) · Marchetti-Okafor (learning science ×2 passes) · Halvorsen (interface) · Reyes (first dollar) · Okonkwo (architecture) · Voss (red team) · adversarial fact-verifier · Solano (this synthesis) — T4 staged production, three research passes, ~40 web searches, every load-bearing claim adversarially verified.

**Selva review:** complete (§14) — the repo went public and it turns out to be a dress rehearsal for this exact product. This document doubles as the drop-in build brief for Claude Code: Appendix A is the contract, Appendix B is the One-Run Protocol — committee-gated (8/10 to proceed), self-testing via Desktop Commander + Chrome, built to ship all six items autonomously in a single run.

---

## 1. What this is

A web app that teaches you how to do research and take notes the way Duolingo teaches Spanish — except the "lessons" happen on your real project, inside the tool itself, and the method being taught was designed for a neurodivergent brain instead of against it.

Three ideas fused into one product:

1. **A new note-taking method — the Sieve Method** — built from ND cognition research (working-memory offloading, zero-decision capture, machine-side organization, app-initiated resurfacing) and grounded in the reputable canon (Kuhlthau's ISP, QFT, SIFT/lateral reading, synthesis matrix). You never file anything. You pour everything in; the system sieves, returns, and asks.
2. **A Duolingo-style skill path** — six tracks, ~27 micro-units, each 2–10 minutes, each performed on your actual research project, each named after the framework it descends from. Finishing a unit produces a real artifact in your vault, never a sandbox exercise.
3. **Gamification with the cruelty surgically removed** — no breakable streaks, no hearts, no leagues, no decay. A lifetime bricks counter that only goes up, quests generated from your own notes, loud celebration of *returns* after absence.

The organizing insight (and the echo of the Annex's honest-shelf rule): **the reps are the research.** You don't practice note-taking on fake material and then go do real work. Every drill, every quest, every resurfaced card operates on the thing you're actually trying to learn or produce. The curriculum and the tool are the same machine.

Why this product, for this builder: you've said you've always struggled with research and note-taking. That's not a liability here — it's the qualification. Every comparable that won in the ND space (Goblin Tools, Llama Life, AudioPen) won on "built by a brain like yours, for brains like yours," and the clinical-polish competitor (Inflow, VC-backed) is stalling partly *because* it reads like homework from a neurotypical institution.

---

## 2. The verdict first (Solano — read before anything else)

The Reality Check came back **Opportunity In The Gaps** — and for once the gap is real, not just unlit. Three crowded circles (ND note tools, gamified learning, research tools) with a verified-empty intersection: no consumer product, funded or dead, currently gamifies the meta-skill of research and note-taking itself. Duolingo's 2025–26 expansion went to math, music, and chess — nothing metacognitive. The nearest prior art is grant-funded library games that died when the grants did. This absence was searched for hard, adversarially, and survived. It stands as "no counterexample found," which is the honest maximum for a negative claim.

But Voss landed three punches this plan absorbs rather than argues with:

**One: this is two products in a trench coat, and you can afford one.** A curriculum and a PKM engine have different retention loops. The plan resolves it: **v1 is the engine with exactly one embedded lesson moment.** The full skill path is designed (§7) and frozen. It unfreezes when engine retention data earns it.

**Two: the income cliff is underfoot, not approaching.** You left the day job May 1st. It is late July. This plan therefore has a runway rule (§13) it refuses to proceed without: the Sieve is a nights-and-weekends build behind a paid-validation gate, it never displaces income work (Hous Sites clients, NervaHous services hold first position — same rule as the Annex), and there is a written kill date.

**Three: the "teach vs. do-it-for-you" contradiction needs a constitution.** If the AI clusters, summarizes, and drafts, what's the user learning? Answer, adopted as product law (§5): **the AI is the textbook, never the ghostwriter.** The machine does the *clerical* cognition (filing, scheduling, resurfacing — the executive-function tax ND users can't pay). The human does the *epistemic* cognition (judging sources, answering question cards, naming connections, deciding what matters). Any feature that moves epistemic work to the machine is out of scope on principle. This sentence is the moat, because it's the one thing NotebookLM structurally won't do — Google's product exists to do the thinking for you.

**The gates:**

- **Phase 0 (validation, 2 weeks, ~zero code):** landing page + demo + $49 refundable founding preorder. **GO = ≥10 paid preorders from ≤1,500 visitors, plus 5 problem interviews where strangers describe the pain unprompted.** Marginal (6–9 preorders): one re-angle week, then decide. Below that: kill, celebrate the kill, redirect the energy. Wallets are the only data.
- **v0.1 (walking skeleton, 6 weekends, hard-capped):** capture + auto-threading + question cards + daily resurfacing + re-entry card + bare XP. Nothing else.
- **Everything past v0.1 is frozen until 25 strangers use it weekly or founding revenue clears $1,000.**
- **The kill switch is externalized:** weekly cron emails build-progress vs. income-work balance to you *and one human witness with kill authority over scope additions.* An ADHD solo founder cannot be her own tripwire — you wrote that rule for the Annex three days ago; it applies double here.

---

## 3. The committee's questions — asked and answered

The user asked the committee to formulate the questions that would push this build properly. Voss wrote seven designed to kill it. Solano answers. Where the answer changed the plan, the section that absorbed it is cited.

**Q1. Is this one product or two wearing a trench coat?**
Two — admitted. A gamified curriculum and a capture-cluster-resurface engine compete for the same scarce user session. **Answer:** v1 ships engine-only with one lesson moment (a QFT-style question prompt at capture). The curriculum exists on paper (§7), fully designed and lineage-named, and unfreezes unit by unit only when A/B data shows lesson moments lift retention rather than delaying the outcome the user came for. The skill tree is the *roadmap*, not the MVP.

**Q2. If the AI clusters and synthesizes, what is the user actually learning — and why pay to learn it?**
The user learns *judgment over AI output* — the one research skill that appreciates while every other one deflates. The constitution in §5 draws the line mechanically: machine does clerical cognition, human does epistemic cognition. Concretely: the AI proposes thread groupings, the user confirms or redirects (that's a categorization judgment rep). The AI generates question cards; the user answers them in their own words (that's retrieval + elaboration). The AI assembles the draft scaffold from the user's *answered* cards only — it cannot cite a card the user never engaged. Payment logic: you're not paying to learn a skill, you're paying for finished artifacts that — as a side effect the product never shuts up about internally and never advertises externally — make you sharper each cycle.

**Q3. Why does this beat NotebookLM at $0?**
Named in one sentence, per Voss's demand: **NotebookLM is a reading prosthetic that does your thinking; the Sieve is a thinking gym that does your filing.** Google renamed NotebookLM to Gemini Notebook on July 16 and is pushing it hard — but its direction of travel is *more* do-it-for-you (auto study guides, audio overviews, slide decks), not less, because that's what horizontal scale rewards. The emotional contract — Kuhlthau-aware dip detection, shame-free re-entry, the bricks ledger, ND-first pacing — is the thing a horizontal product can't justify fanatical execution on. Also structurally: notebooks are still siloed boxes with weak export; the Sieve is a durable, exportable, cross-project note layer — the place Gemini Notebook's outputs would want to live. Treat this gap as closing, not stable; ship accordingly.

**Q4. Can a builder who struggles to finish research-heavy work finish a research-heavy build?**
Not by willpower, and the plan stops pretending otherwise. Mitigations, all structural: (a) the curriculum's literature synthesis is *already done* — it's §7 of this document, produced by the committee, so the units are writing-to-spec, not research; (b) v1 needs zero units written beyond one prompt; (c) 6-weekend hard cap with a fixed scope list (§10) and a human witness holding kill authority over additions; (d) the build itself is dogfooding — plan notes, feature research, and unit drafts go through the Sieve's own capture flow from week one. If the tool can't carry its own construction, that's data.

**Q5. Where is the money coming from between now and revenue?**
Not from this app — and the plan is only honest if it says so in bold. **The Sieve is not the income plan; it is the equity bet that rides behind the income plan.** Client work (Hous Sites, NervaHous services) holds first position in every week's schedule, exactly like the Annex's call-sheet rule. The written runway rule lives in §13: a named monthly burn floor, a named date (default: October 31, 2026) by which the Sieve must show either $1,000 attributable revenue or 25 weekly-active strangers, and a pre-committed consequence (freeze the build, keep the paper method, keep the audience warm). Founding-lifetime money is escrowed against a shipping promise: automatic refunds if v1 isn't live by a date printed on the checkout page.

**Q6. What happens in week 5, when the novelty dopamine is gone?**
Consumer productivity apps retain 3–6% at day 30, and this demographic is selected for novelty-seeking. The answer is not a better trick — it's **external deadline gravity.** Onboarding asks for a real project with a real date (thesis due, client deliverable, launch, exam). The app instruments everything around *finishing dated artifacts*, and D30 return-to-project rate — not opens — is the metric with decision authority. Resurfacing arrives by email (which works on people who don't open apps), quests regenerate from the user's own notes (novelty from their material, not from our content mill), and the return-after-absence experience is the most polished screen in the product because the relapse moment is where every ND tool dies.

**Q7. Does the validation gate actually validate anything?**
The original gate (10 preorders) validated the ad, not the product. Upgraded per Voss: 10 refundable preorders **plus 5 problem interviews** where strangers describe the tab-pile/note-chaos pain unprompted, **plus** a pre-committed rule for marginal results (6–9 preorders = one repositioning week, then a binary call), **plus** printed refund terms. Additionally the $29 "Research Sprint" paid pilot (§11) tests whether people pay for the *method* before any code exists — if ten people pay $29 to be walked through the Sieve Method in a Notion template, the method has a wallet even if the app doesn't yet.

**The three silences Voss flagged, now spoken:** the runway number lives in §13; the human witness with kill authority is a named requirement of Phase 0 (recruit them before writing code — the same person can serve both this and the Annex tripwire); and the teach-vs-do constitution is §5, printed above every feature decision.

---

## 4. Who it's for (and the expansion rings)

**Ring 0 — Jene.** Me-first, by explicit decision. The builder is the first user, the method is tuned on the builder's actual brain, and the build itself is the first research project run through it. Nothing ships to Ring 1 that didn't survive Ring 0.

**Ring 1 — ND knowledge workers drowning in tabs.** Adults with ADHD-type cognition who capture endlessly and synthesize never: 47 tabs, 9 half-filled note apps, screenshot graveyards. They buy outcomes, not skills — so the positioning sells the artifact ("turn your tabs into a finished doc") and smuggles the curriculum, Duolingo-style.

**Ring 2 — students (incl. late-diagnosed ND students).** Deadline-driven wallets, seasonal spikes (September, January), reachable via r/GradSchool, r/PhD, StudyTok. Same product, .edu landing page.

**Ring 3 — the NervaHous long game.** The 20-year roadmap's Phase 2 is an AI-native gamified education platform. The Sieve is its first organ grown in public: a living demonstration that NervaHous doesn't just talk about learning with AI — it builds the machines. Curriculum, badge systems, and living-portfolio mechanics developed here transfer directly to the EdHeads-style platform later.

---

## 5. The Sieve Method (the product's spine — and its constitution)

**The metaphor:** you never file. You pour everything through, and the sieve catches what matters, returns it at the right moment, and asks you the question that turns a scrap into knowledge. Named artifacts: **Catches** (raw captures), **Threads** (emergent clusters), **Question Cards**, **the Return** (daily resurfacing), **the Weave** (assembly into output).

**The constitution — one line, printed above every feature decision:**

> **The machine does clerical cognition. The human does epistemic cognition. The AI is the textbook, never the ghostwriter.**

Clerical (machine's job, always): transcribing, filing, tagging, clustering, scheduling, resurfacing, formatting, citation capture, remembering. These are the executive-function taxes that bankrupt ND users in every other tool.
Epistemic (human's job, always): judging a source, answering a question card, naming a connection, choosing a focus, deciding what dies. These are the reps. The product exists to protect them, shrink them to doable size, and celebrate them.

**The five stages, mapped to the failure they defeat:**

| Stage | Who | What happens | ND failure defeated | Lineage |
|---|---|---|---|---|
| **1. Catch** | Human, seconds | Voice memo, pasted link, screenshot, half-sentence — no titles, no folders, no decisions. App timestamps, transcribes, scrapes, auto-cites. | Working-memory overflow at capture; the filing decision that kills the save | Big6 §4 (extract); Barkley: externalize at point of performance |
| **2. Sieve** | Machine, automatic | AI clusters catches into Threads (incremental assignment — existing notes never silently move), extracts claims, generates one question card per meaningful catch | The organization trap; decision fatigue; "where does this go?" | Elaborative interrogation (Dunlosky); cognitive-load theory |
| **3. Return** | App-initiated, ~2 min/day | 3–5 due question cards arrive (email + in-app). Answering in your own words IS the note refinement. FSRS-scheduled; the human never manages a review calendar | Out of sight = gone; self-initiated review that never happens; time blindness | Retrieval practice (Knouse et al. 2016 — works for ADHD at full magnitude); FSRS spacing |
| **4. Re-entry** | App + human, 30 sec | Opening any project: what you believed last time, the open question you left, one suggested micro-task. Never a blank page, never a guilt wall | The re-entry death — where abandoned projects actually die; blank-page paralysis | Kuhlthau ISP; state-restore as retrieval practice |
| **5. Weave** | Human, sessions | Drafting = arranging your answered cards under your questions. Outline precipitates out of the sieve; writing becomes assembly | Blank-draft initiation cliff; synthesis as working-memory juggling | Synthesis matrix (UNC canon); reverse outlining (Purdue OWL) |

**The emotional layer (the thing no competitor ships):** Kuhlthau's Information Search Process documents that research *feels bad in the middle* — uncertainty and anxiety spike during Exploration, and that's the documented shape of the work, not a defect in the researcher. The app operationalizes this: it detects dip signals (source-thrashing, deletion spirals, long idles mid-project) and surfaces a named state — *"You're in the Dip. This is stage three of six. It's supposed to feel like this."* — with a 2-minute dip-legal unit (log three contradictions; don't resolve them). Floundering is never penalized, because floundering is the work. For an RSD-prone user, normalizing the dip is the retention lever no amount of confetti can buy.

**Method claims, confidence-labeled (per the fact-check pass):** retrieval practice for ADHD — strong, verified citations. FSRS/spacing — strong. QFT, SIFT/lateral reading — strong (lateral reading effects real but modest; boosters required — which is exactly what a spaced app provides). Zettelkasten/progressive summarization as ND defaults — rejected on mechanism, position held. Body doubling — emerging evidence, shipped as optional co-presence, not load-bearing. The "48% streak-freeze" stat floating around is Trophy's cross-app data, not Duolingo's — direction holds, number retired.

---

## 6. Gamification spec — designed for the worst day

Design axiom: assume the user opens the app at 11:40pm, ashamed, three days absent, 4% battery. Every mechanic is judged on that day.

**Shipped in v1:**

1. **Bricks (lifetime counter).** Smallest unit of "did research" = one catch or one answered card = one permanent brick. Monotonic — *no code path decrements it.* The data model does not contain a reset state. Worst day: open, one tap, one sentence, brick minted, close. Three interactions.
2. **Silent infinite grace + loud return ritual.** Absence is never rendered as a gap. Returning triggers the warmest screen in the app: welcome, 30-second state restore, one suggested micro-step. The relapse moment gets the most design attention because it's where ND tools go to die.
3. **One Next Tile.** On open: exactly one lit suggested micro-action, derived from your actual state ("You caught this yesterday — turn it into one question?"). Free-roam escape hatch always visible for hyperfocus. One tap from open to working.
4. **Quests from your own notes.** Rotating micro-quests generated from the user's material: "Two of your catches disagree — referee them." "This thread has no question yet — give it one." Novelty from *their* corpus, not our content. Unclaimed quests vanish without penalty or residue.
5. **Hyperfocus harvest.** Session artifact that grows during a sprint; when a burst ends, the app banks it visibly ("14 connections in 90 minutes") with bonus bricks. Bursty output is the ND signature — the system banks bursts instead of demanding evenness. A 3-hour Tuesday visibly outweighs five absent days.

**Banned forever (printed in the repo's DESIGN-PRINCIPLES.md):**

1. **Breakable streaks** — any resettable consecutive-day metric, including streak-with-freezes. The guillotine existing is the problem. Streak anxiety is documented; for this audience the broken streak is the last session.
2. **Punishment mechanics** — hearts, decay, pet damage, red overdue badges, any state that visually worsens through inaction. Habitica's damage model is the canonical ADHD failure case.
3. **Leagues / ranked comparison.** Ambient co-presence ("3 people are sieving right now") allowed later; ranking never.

**Celebration language:** hard-shadow stamps slamming onto paper — *FIRST CATCH LOGGED* — snappy, brutalist-native, `prefers-reduced-motion` respected. Formulation (finding your angle) is the game's biggest milestone, celebrated harder than finishing, because Kuhlthau found most people skip it and produce mush.

**Companion question (deliberately deferred):** Finch proves an externalized-self-compassion companion works; the Annex's Marlow proves a dry senior sidekick works. v1 ships *voice, not avatar* — the app's system voice is warm-dry, Marlow-adjacent, never chirpy. A visible companion is a v2 A/B, not a v1 bet.

---

## 7. The curriculum — six tracks, frozen until earned, every unit lineage-named

Full design retained so that when engine data earns it, units unfreeze in order. Delivery: 2–10 minute do-first units on the user's real project. Tracks unlock loosely (~half a track opens the next). Replays mint bricks; replay is practice, never remediation. The canon is deliberately broken in three places: we start at Capture because initiation is the disability (Big6 would call that doing stage 4 first — correct, that's the point); tracks render as a *map*, never a staircase (revisiting is traversal, not regression); and every evaluative skill gets FSRS booster drills, because the 2024–25 misinformation literature shows these skills decay without them — the gamification is the delivery mechanism the canon lacks.

**Track 1 — Catch (4 units):** 1.1 One capture point, zero friction (Big6 §4; ubiquitous-capture lineage) · 1.2 Capture verbatim, judge never (QFT rule 1) · 1.3 Source snapshot — provenance rides with the quote (SIFT pre-work) · 1.4 The contradiction log (Kuhlthau Exploration-stage action).

**Track 2 — Ask (5 units):** 2.1 Question Burst — 4 rules, 4 minutes (QFT, Right Question Institute) · 2.2 Open/closed flip drill (QFT improvement step) · 2.3 Prioritize three + why (QFT prioritization) · 2.4 PICo your problem — population/interest/context for civilians (PICO lineage) · 2.5 The focus sentence (Kuhlthau Formulation gate — required to unlock Weave units).

**Track 3 — Judge (5 units):** 3.1 Stop first — the 10-second pause (SIFT "S") · 3.2 Lateral reading drill — leave the page, open three tabs (Wineburg & McGrew; Breakstone et al.) · 3.3 Click restraint on the results page (SHEG/Digital Inquiry Group) · 3.4 Trace the claim to its original (SIFT "T") · 3.5 Booster rounds, FSRS-scheduled (Nature Human Behaviour 2024: effects decay without reinforcement).

**Track 4 — Weave (5 units):** 4.1 Build a 3×3 synthesis matrix from your notes (UNC/UAGC canon) · 4.2 Read the row — one sentence per theme (matrix method) · 4.3 They Say in one sentence (Graff & Birkenstein) · 4.4 I Say — agree/disagree/both, templated (templates as initiation prosthetics) · 4.5 Name your turn in the conversation (ACRL: Scholarship as Conversation).

**Track 5 — Ship (4 units):** 5.1 Ugly first draft from the matrix (Lamott lineage; Big6 §5) · 5.2 Reverse-outline what you wrote (Purdue OWL — revision as a diff operation, ND-mechanical) · 5.3 One paragraph for a real human (ACRL: Information Creation as a Process) · 5.4 Ship + retrospective — map your emotional log to the ISP curve (Kuhlthau Presentation; builds the self-knowledge that the next dip is survivable).

**Track 6 — Research WITH AI (5 units, first-class, not a cheat):** 6.1 AI as exploration partner in the Dip, not oracle (OU Critical AI Literacy 2025) · 6.2 Prompt like a question-former — QFT questions become prompts (prompt-literacy competency models) · 6.3 SIFT the bot — lateral-read an AI answer (Caulfield's own SIFT-for-LLMs extension) · 6.4 Citation autopsy — verify every AI reference exists and says what's claimed (2025 library guidance) · 6.5 Disclosure & division of labor — one sentence on what AI did vs. what you did, framed as craft pride (UNESCO guidance).

**v1 carries exactly one lesson moment:** the capture-flow question prompt (a distilled 2.1). Everything else waits for data.

---

## 8. Design direction — Brutalist Editorial, adapted

The provided mockup ("The Parchment" — neo-brutalist editorial) is the north star: cream paper ground, ink-black structural borders, hard offset shadows, serif display type with italic emphasis, mono machinery text, one acid accent, chunky tab bar, stamp-like badges. It adapts to this product unusually well — the aesthetic *is* the metaphor (research as a working press; catches as clippings; threads as editions).

**Tokens (draft):**

- Ground: `#EFEAE3` (parchment) · Ink: `#111110` · Accent: acid chartreuse `#D8F21D` (state and celebration ONLY — never the sole carrier of meaning; WCAG-checked pairs listed in the repo) · Danger/never: no red punishment states exist.
- Type: serif display (e.g., Instrument Serif / Freight-adjacent) for meaning; grotesque (Inter/Archivo) for body; mono (IBM Plex Mono / JetBrains) for machinery — timestamps, system voice, citations, counts. Two-voice rule: serif = the human's material, mono = the machine talking. The user always knows who's speaking.
- Borders 2–3px solid ink; shadows hard-offset (4–6px, no blur); radius small (2–6px); celebration = stamp animations, 200–350ms, `prefers-reduced-motion` honored.

**Brutalist-but-usable rules (from the teardown, kept):** contrast is rationed — one focal point per screen, calm reading surfaces inside loud chrome; hard borders double as affordance (a bordered+shadowed element is pressable, unambiguous — good for ND parsing); generous whitespace (24–32px+); the acid accent never carries semantic weight alone; every text/background pair passes WCAG AA.

**The interface commandments (engine-relevant subset):** one dominant next action, always · never render a blank page (every empty state is pre-seeded with instruction or material) · capture costs zero decisions · value before identity — full capture-and-sieve demo before any signup wall · structure is the product, flexibility is the trap (opinionated containers, customization is a settings-page privilege, never the front door) · retrieval never depends on memory (search + resurfacing + suggested links) · guidance in the moment, never a 10-screen tour.

**The first 90 seconds (cold open, from Halvorsen's script):** land on one serif question — *"What are you trying to figure out?"* — one input, one acid button, no nav (~3s to first meaning). They type a topic or paste a link/PDF; mono ticker shows the sieve visibly working ("reading… found 3 threads…"). App returns a pre-built expedition: three cards + one spicy question (~30s, first personalized meaning). One lit action: open card 1, read 30 seconds, tap one reaction (~75s, first contribution at near-zero effort). Stamp slams: *FIRST CATCH LOGGED* (+XP) — and only then: "Save your expedition?" → signup (<90s, value before identity). At no point before 90s: a structural decision, a second primary action, or a blank page.

---

## 9. Technical architecture

**Stack (aligned with the Annex — one set of muscles, two apps):** Next.js 16 / React 19 / Tailwind 4 on Vercel · Supabase (Postgres + pgvector + Auth + Storage + pg_cron + Edge Functions) · Vercel AI SDK (`ai` v7) with Gemini 2.5 Flash-Lite as primary bulk model and Gemini 2.5 Flash for re-entry synthesis (one vendor, one SDK, one bill; verified pricing $0.10/$0.40 and $0.30/$2.50 per M tokens) · Groq-hosted `whisper-large-v3-turbo` for transcription (verified $0.04/hr of audio; OpenAI fallback) · `text-embedding-3-small` for embeddings (verified $0.02/M) · `ts-fsrs` for scheduling (verified: MIT, FSRS v6, active June 2026 release) · Mozilla Readability + `open-graph-scraper` self-hosted for link extraction, Jina Reader fallback, Firecrawl only if paywall pain is proven · **Polar** for payments (merchant of record; verified current pricing **5% + 50¢** for new orgs as of May 2026 — the 4%+40¢ legacy rate is gone; margin math in §11 uses the real number) · Supabase Auth magic links.

**Data model (core tables):**

```
users            (id, email, settings, timezone, project_deadline_fields)
projects         (id, user_id, title, real_deadline, focus_sentence, isp_stage_signal)
catches          (id, user_id, project_id?, thread_id?, type[voice|link|text|image],
                  raw_content, transcript, source_url, source_meta jsonb,
                  claim_extract, embedding vector(1536), status[raw|sieved|failed_extract],
                  created_at)   -- capture NEVER fails: raw persists synchronously, enrichment is async
threads          (id, project_id, name, centroid vector(1536), size, last_activity,
                  merge_suggestions jsonb)   -- existing catches never move without visible suggestion
question_cards   (id, catch_id/thread_id, question, user_answer, answer_history jsonb,
                  fsrs_state jsonb, due_at)
bricks           (id, user_id, source_action, created_at)   -- append-only; no decrement path exists
quests           (id, user_id, generated_from jsonb, prompt, expires_at, claimed_at?)
sessions         (id, user_id, started_at, ended_at, harvest jsonb)
events           (append-only analytics: capture, answer, return_after_absence, dip_signal, weave_export)
```

**The Sieve pipeline (all async, capture is sacred):** raw input persists synchronously first — capture succeeds even when every downstream API is down, with a visible "still sieving" state. Then: transcribe/scrape → extract claim + metadata → embed → incremental thread assignment (cosine vs. thread centroids, threshold ~0.75, else spawn thread; **no batch re-clustering ever** — HDBSCAN-style global reshuffles destroy trust overnight) → nightly LLM audit names threads and *proposes* merges/splits (proposes; never silently moves) → question-card generation for meaningful catches.

**Scheduling:** pg_cron on Supabase (verified: available on all tiers) drives the daily Return batch and nightly audits — not Vercel cron (Hobby: once daily, hour precision, and non-commercial-use terms verified). Jobs are chunked + idempotent via a queue table **from commit one**, because serverless batch jobs breaking silently at ~500 users is the known failure shape; the eventual $5 Railway worker is then a config change, not a rewrite.

**Cost reality (verified):** $0/mo while building (all free tiers; note Supabase free pauses after 7 idle days — the daily cron itself keeps it warm, and launch means Pro anyway). ~$70/mo at 100 users (Supabase Pro $25 + Vercel Pro $20 + AI ~$25 — against $600–800 MRR if they're paying). ~$350–500/mo at 1,000 users (~7% of revenue). Per-user AI cost lands around $0.20–0.50/mo — transcription is a rounding error at $0.05.

**The three hardest technical risks, ranked:** (1) **Clustering trust** — one "why is my recipe in my thesis thread" session kills the no-filing promise; mitigations: incremental assignment, visible-suggestion-only moves, embedding versioning so a model swap can't scramble history. (2) **Capture-path fragility** — voice, OCR, scraping are three flaky dependencies on the one feature ND users won't forgive; mitigation: synchronous raw persistence, async everything else, graceful "couldn't extract, saved anyway." (3) **Serverless job-shape mismatch** — mitigated from day one as above.

---

## 10. Roadmap — v0 to the horizon

**Phase 0 — Validate (2 weeks, ~zero code).** Landing page (outcome headline: *"Turn your 47 tabs into a finished doc"*), 60-second demo (Figma/screen-recorded prototype), two buttons: free waitlist + **$49 refundable founding preorder** (printed ship-date refund guarantee). Announce to NervaHous audience; 5 TikToks/Reels of the demo; 2 honest posts in adjacent subs (r/ADHD_Programmers, r/GradSchool, r/NoteTaking — never r/ADHD, self-promo ban verified). Week 2: the **$29 Research Sprint** — 90-minute cohort walking 10 people through the Sieve Method in a Notion template. Recruit the human witness. Run 5 problem interviews. **Gate: §2 numbers, pre-committed.**

**v0.1 — Walking skeleton (6 weekends, hard-capped).** W1: repo scaffold in NervaApp, auth, capture (text+link) with synchronous raw persistence. W2: voice capture + transcription; Readability scraping + citation capture. W3: embedding + incremental threading; thread UI. W4: question-card generation; the Return (daily email + in-app, ts-fsrs). W5: re-entry card; bricks + One Next Tile; the capture-flow lesson moment. W6: brutalist design pass; onboarding cold open; founding-member beta ships to preorder buyers. **Cut from v1 on principle:** draft assembly/Weave UI, screenshot OCR, full gamification, thread-merge UI, payments beyond Polar checkout link, companion avatar, mobile PWA polish.

**v0.5 — The Return matures (weeks 7–12).** Quests from own notes; hyperfocus harvest; dip detection v1 (rule-based signals); Weave v1 (matrix view + outline export to Markdown/Docs); Polar subscriptions go live ($8/mo, $49/yr); founding lifetime closes at 150 seats.

**v1.0 — Public (target: fall 2026, gated on 25 weekly-active strangers or $1k).** Track 1 + 2 units unfreeze (first A/B: does the lesson moment lift D30 return-to-project?). Public launch: ADHD-tok demo campaign, Product Hunt for the backlink not the users, NervaHous build-in-public series as top-of-funnel.

**v2 — The method has a name in public (2027).** Tracks 3–6 unfreeze unit by unit. Booster drills ship (the spaced misinformation-literacy layer no one else has). Companion A/B. Cohort product v2 (the Research Sprint becomes a recurring paid onboarding — cohorts monetize ND accountability better than software alone). Educator/coach affiliate channel (30%).

**v3 — The NervaHous convergence (2027+).** Living portfolios: a user's answered cards, shipped artifacts, and emotional-arc history become a durable, exportable record of how they think — the exact mechanic the Phase-2 education platform needs. Team/classroom spaces (a teacher sees ISP-stage signals across a class). The Sieve Method published as NervaHous curriculum content (the app is the lab; the content brand is the amplifier). If the 20-year roadmap holds, this is the organ that grows into the EdHeads-style platform's research-skills wing.

---

## 11. Money — pricing, channels, and the first dollar

**Pricing (comparables verified):** Free tier = one active project (the demo surface, not the business). **Pro $8/mo, $49/yr** (annual anchored front and center — Llama Life's winning zone, ~$135K ARR solo, third-party estimate). **Founding lifetime $129, capped at 150 seats**, launch window only — the validation instrument and the first $10–19K. No VC freemium: subscription fatigue is loud in ADHD communities, short trials beat feature-gated tiers because ADHD users churn at friction, not price. Polar's real take on $8 is ~$0.90 (5%+50¢, verified) — priced in.

**Channels, ranked:** (1) **Short-form ADHD-tok** — the product demo IS the content; "watch me dump 40 tabs in and get an outline back" is inherently filmable, and it's how Goblin Tools, Finch, and Tiimo actually grew. (2) **Adjacent subreddits** — honest builder-with-ADHD posts in tool-native subs; highest intent per visitor. (3) **NervaHous owned audience** — smallest reach, warmest wallets, the founding-lifetime buyers. Product Hunt: backlink only. Coach partnerships: month 3+.

**Brand architecture:** sub-brand — **"[app name] by NervaHous."** The app needs its own ownable name for ADHD-tok and search; NervaHous supplies the credibility halo and permanent top-of-funnel. (Repo stays NervaApp; product naming is a Phase-0 decision — "Selva" itself is a candidate if the review reveals it's this idea's ancestor. "Sieve" is the method's name; the app wants something warmer.)

---

## 12. What we measure (and what we refuse to)

Decision metrics: **D30 return-to-project rate** (the retention truth), capture→answered-card conversion (is the epistemic loop alive), weekly artifacts shipped, dip-survival rate (users who hit dip signals and return within 7 days), preorder/refund numbers. Vanity metrics explicitly refused: opens, total notes stored (hoarding is the disease, not the KPI), brick totals in aggregate. Analytics: the append-only `events` table + PostHog free tier; no third-party ad pixels in an app for a vulnerable audience.

---

## 13. The runway rule (written down, per Voss)

The day job ended May 1, 2026. Therefore: **(a)** income work holds first position in every week — the Sieve gets nights/weekends only, same call-sheet rule as the Annex; **(b)** the monthly burn floor and months-remaining number live in a private file Jene maintains (not in this repo) and get reviewed at the weekly witness check-in; **(c)** by **October 31, 2026**, the Sieve shows $1,000 attributable revenue or 25 weekly-active strangers, or the build freezes — the paper method, the audience, and this plan survive the freeze; the code waits; **(d)** founding money carries an automatic-refund ship-date promise; **(e)** the weekly cron emails the build-vs-income balance to Jene *and* the witness. The plan treats "shipping this app will supply the executive function to ship this app" as the untested hypothesis it is — and externalizes the structure instead.

---

## 14. The Selva review — the dress rehearsal nobody planned

Selva (github.com/Rrcher404/Selva) is a Duolingo-style Spanish immersion app Jene shipped July 20–21, 2026: Vite + React 18 + TS, zero runtime deps beyond React, local-first localStorage progress with an optional Supabase sync layer whose JSONB column mirrors the local shape 1:1, PWA with install coach, Web Speech TTS + recognition, SM-2-lite SRS (44 lines), 8 exercise types, 10 units / 31 lessons. A four-persona design-research pass (`docs/DESIGN_RESEARCH.md`) produced a ranked backlog — and all six "weekends" of it shipped in two days with Claude Code.

**What Selva proves (three things this plan was only asserting):**

1. **The velocity is real.** The Sieve's 6-weekend v0.1 cap was sized against normal solo speed. Selva's six-weekend backlog shipped in ~48 hours. Keep the cap (Voss holds that line — scope grows to fill trust), but treat it as a ceiling, not an estimate.
2. **The taste is already calibrated.** Selva independently arrived at this plan's ethics: no hearts, no default leagues, no purchasable streak repair, no loot boxes, no guilt notifications, skippable celebrations, records-over-badges, `prefers-reduced-motion` handled everywhere. The banned list in §6 isn't aspirational — it's already house style.
3. **The engine patterns exist as working code.** This de-risks half of §9.

**The port list (lift with adaptation, order of value):**

- **`quests.ts` pattern** — deterministic date-seeded quest rotation (mulberry32 PRNG, ~50 lines, zero persistence, explicitly no variable-ratio mechanics, quests route attention to surfaces that don't advertise themselves). The Sieve's quests add one layer: targets generated from the user's own notes, but the rotation/determinism/no-gambling skeleton ports verbatim.
- **La Cosecha sequenced reveal** — the lesson-complete screen shows *the honest number first* (words learned), then XP roll-up, any tap skips. For the Sieve: connections made / questions answered lead, bricks and XP follow. "XP is screen-time; the honest number is comprehension" is a keeper principle.
- **`store.ts` shape discipline** — flat local-first JSON mirrored 1:1 by a Supabase JSONB column; lifetime records that "only ever go up — a bad Tuesday can't erase them" (that comment is the bricks data model, already written); daily counters that quests read; day boundary at 04:00 local (ND-correct: a 1am session belongs to yesterday).
- **Juice stack** — `motion.css`/`fx.ts`/`theme.css`: 90ms-down/260ms-overshoot press physics, layered hue-shifted shadows, AudioContext chime pool, canvas-confetti dynamic-imported and milestone-only. Retint from jungle OKLCH to parchment/ink/acid — the elevation and motion system carries over untouched.
- **InstallCoach.tsx** — PWA install flow (native prompt where available, illustrated iOS steps, auto-skip when standalone). This resolves the old open slot #4: capture-on-phone lands in v0.5 as a PWA, mostly by porting this file. <2s-to-capture is the spec.
- **Intro pattern** — demonstrate, don't explain; signup after first win; skip from frame one. Already §8's cold-open philosophy, now with a shipped reference implementation.

**Two deliberate non-ports, with reasons:**

- **The SRS: keep ts-fsrs, not Selva's SM-2-lite.** SM-2 was right for 120 vocabulary words. The Sieve schedules heterogeneous question cards with implicit grading over months — FSRS's retrievability model earns its extra complexity. Port the *surrounding* wisdom instead: cap the daily queue, silently drop low-value cards, "miss it, see it again" requeue.
- **El Vivero's wilting plants — inverted, not copied.** Selva's SRS garden (words as plants that droop when due) is its most charming mechanic, and it violates §6's ban: state that visually worsens through inaction is punishment in disguise, whatever the art style. For an ND research audience the wilt reads as another disappointed authority. The Sieve ships the inversion: **the Orchard** — due question cards *ripen* toward harvest (color deepens, fruit swells), and an unharvested card simply stays ripe. Same glanceable-SRS-state visualization, same tap-to-review, zero decay signal. (Selva's humane streak — Récord + Días totales + auto-consumed escudos + kind break copy — stays banned here too per §6, but it's the pre-approved fallback A/B if bricks alone don't pull returns.)

**Stack decision, confirmed with a nuance:** the Sieve stays on Next.js 16 (§9) because the AI pipeline needs server routes and cron — but Selva's local-first lesson upgrades the architecture: **capture writes to the client store first** (IndexedDB via a thin wrapper), syncs async, and the UI never waits on a network round-trip. Capture-is-sacred (§9) gets its implementation pattern from Selva's store, not from an API contract.

**Naming note:** Selva is taken by the Spanish app, but it settles the register — living-system metaphors, one warm word, Spanish-adjacent is on brand. Candidates for the Phase-0 landing test: **Cosecha** (harvest — what the Sieve does to your scattered catches), **Huerto** (kitchen garden), or an English sibling (**Grove**, **Harvest**). Method stays "the Sieve Method"; the app wants the warmer name.

## 15. Remaining open slots

1. **Witness recruitment** — one human, weekly 15 minutes, kill authority over scope additions. Precondition for writing code.
2. **App name** — Phase-0 decision, tested on the landing page itself (candidates in §14).

---

## 16. The thing nobody said (Solano, closing)

Every persona treated the builder's ND as the market insight, the design constraint, or the risk factor. Nobody said the quiet part: **this product is the first one where Jene's whole stack of prior builds converges instead of scattering.** The Annex contributed the no-streak philosophy, the FSRS queue, the sidekick voice, and the kill-switch pattern. Selva contributed a working gamified-learning engine, the juice stack, the quest system, and proof that six weekends of scope can ship in two days. Gravity Claw contributed the memory-architecture thinking. NervaHous contributed the audience, the education mission, and the 20-year roadmap this slots into. SuperMemory contributed the vision language. The scattered-projects pattern that usually taxes this builder is, for once, load-bearing — every "unfinished" thing turns out to have been R&D for this one. That's either a beautiful convergence or a very sophisticated rationalization, and the only way to find out is the Phase-0 gate: ten strangers' wallets, two weeks, zero code. Go run it.

---

## Appendix A — Drop-in build brief for Claude Code

This appendix is the operational contract. Drop this whole file into the NervaApp repo root as `MASTER-PLAN.md`, point Claude Code at it, and start with the first-session prompt below. Sections §5 (constitution), §6 (banned mechanics), and §9 (architecture) are law; everything else is context.

### Repo setup

```
NervaApp/
├── MASTER-PLAN.md            ← this file
├── CLAUDE.md                 ← generated in session 1 from the conventions below
├── DESIGN-PRINCIPLES.md      ← the banned-mechanics list + interface commandments, verbatim from §6/§8
├── app/                      ← Next.js 16 App Router
├── components/
├── lib/
│   ├── store.ts              ← local-first client store (port Selva's shape discipline)
│   ├── srs.ts                ← ts-fsrs wrapper (queue cap, silent drop, requeue-on-miss)
│   ├── quests.ts             ← port Selva's deterministic rotation, note-derived targets
│   ├── sieve/                ← capture pipeline: transcribe, scrape, embed, thread, question-gen
│   └── fx.ts                 ← port Selva's juice stack, retinted to parchment/ink/acid
├── supabase/                 ← migrations (schema in §9), pg_cron jobs, RLS from day one
└── scripts/seed.ts
```

### Conventions (put these in CLAUDE.md)

- Stack: Next.js 16 / React 19 / Tailwind 4 / TypeScript strict. Supabase (Postgres + pgvector + Auth magic links + pg_cron). Vercel AI SDK v7; Gemini 2.5 Flash-Lite for bulk (question-gen, thread naming), Gemini 2.5 Flash for re-entry synthesis. Groq whisper-large-v3-turbo, OpenAI fallback. `text-embedding-3-small`. `ts-fsrs`. Polar for payments (not in v0.1).
- **Capture is sacred:** raw input persists to the client store synchronously and to `catches` with `status='raw'` before ANY enrichment. Every pipeline step is async, retried, and idempotent via the queue table. A capture must succeed with all external APIs down.
- **Threads never shuffle:** incremental centroid assignment only (cosine ≥ ~0.75 else new thread). No batch re-clustering, ever. The nightly audit *proposes* merges/splits in `merge_suggestions`; the user confirms. Version the embedding model in the schema.
- **Bricks are append-only.** No decrement path may exist in code. Lifetime records only go up.
- **No animation library.** CSS + the ported fx stack; canvas-confetti dynamic-imported, milestone-only. `prefers-reduced-motion` on everything. Day boundary 04:00 local.
- **Two-voice type rule:** serif = the human's material, mono = the machine speaking. The user always knows who's talking.
- **Banned forever (reject any feature request that smells like these):** breakable streaks in any form, punishment/decay states (including wilting visuals — ripen, never rot), ranked comparison, guilt notifications, variable-ratio rewards, unskippable celebrations.
- Every PR-sized change ends with: does this move clerical work to the machine or epistemic work? If epistemic → stop, it's out of constitution.

### Build order (maps to §10, one weekend per line, acceptance criteria inline)

1. **Scaffold + capture.** Next app, Supabase schema (§9 tables), magic-link auth, text+link capture with synchronous raw persistence and "still sieving" state. ✓ = a pasted link survives airplane mode and appears cited when back online.
2. **Voice + scraping.** Groq transcription with OpenAI fallback; Readability + open-graph-scraper, Jina fallback; graceful "couldn't extract, saved anyway." ✓ = a 60s voice ramble becomes a cited, transcribed catch.
3. **The Sieve.** Embeddings, incremental threading, nightly pg_cron audit that names threads and writes merge proposals. ✓ = 30 mixed catches self-organize into ≥3 sane threads with zero user filing.
4. **The Return.** Question-card generation on meaningful catches; ts-fsrs scheduling; daily email + in-app queue (cap ~5, silent drop). ✓ = answering a card in your own words updates FSRS state and mints a brick.
5. **Re-entry + game layer.** Re-entry card (last belief, open question, one micro-task), One Next Tile, bricks counter, quest rotation, the capture-flow QFT lesson moment. ✓ = returning after 3 days absence shows warmth + state restore, never a gap.
6. **Skin + cold open.** Brutalist Editorial pass (§8 tokens), the 90-second onboarding, La Cosecha-style session-end reveal (honest number first), founding-member beta gate. ✓ = a stranger reaches FIRST CATCH LOGGED in under 90 seconds without an account.

### First-session prompt for Claude Code

Superseded by the One-Run Protocol — use the launch prompt at the end of Appendix B. The constitution rule survives unchanged: §5 and the banned list override anything asked for in the heat of the moment — if a violating feature is requested, quote the plan back and require an explicit "override." That's the witness pattern (§13) encoded into the tooling: the plan holds the line even when the builder is hyperfocused at 2am.

---

## Appendix B — The One-Run Protocol (autonomous build with committee gates)

This encodes a pattern Jene has run before: **a committee grades the next part of the build, and only a score of 8/10 or higher — after testing — clears it to proceed.** Here it becomes the engine of a single continuous run: Claude Code does not stop after item 1. It builds, tests itself in a real browser, convenes the committee, and — on a passing grade — rolls straight into the next item. The target is all six build-order items (Appendix A) shipped, deployed, and browser-verified in one run: one of the first apps fully built end-to-end this way.

### B1. The crew — six agents, each with a persona and a kit

Create these as agent definitions in `.claude/agents/*.md` in session zero. Each file = the Life-Lite block below + its task contract + its toolkit. Personas are substrate, not costume: each one's texture changes what it notices and refuses, not just how it talks.

- **`okonkwo.md` — Lead Builder.** Ships ugly to learn fast; first question is "what breaks first?"; prototypes mid-sentence. Owns implementation of each item. Kit: full write access, Supabase CLI, Vercel CLI, migrations. Forbidden from grading his own work.
- **`kowalczyk.md` — Test Engineer / worst-day proxy.** Designs for the user's worst day; shrinks tasks until stupid-easy; counts interaction steps like calories. Owns the test harness: writes the Playwright specs AND drives the live-browser verification pass (B3). Grades dimension 1 and 4.
- **`halvorsen.md` — Interface Empath.** Every screen is hospitality or contempt; runs the cold-stranger walkthrough; measures seconds-to-first-meaning. Grades UX against §8's commandments — blank pages, decision count at capture, the two-voice type rule. Kit: browser (screenshots via Desktop Commander), DESIGN-PRINCIPLES.md.
- **`marchetti.md` — Constitution Officer.** Mechanisms over hacks; watches where systems fail ND users (initiation, transition, retrieval). Sole authority on §5 compliance: does this feature move clerical work to the machine and keep epistemic work human? Holds the **constitution veto** — a violation fails the gate regardless of the numeric score.
- **`voss.md` — Red Team.** Unvoiced doubt is complicity; cannot say "fails" without "survives if—"; notices what the diff is silent about. Attacks each completed item before grading: race conditions, silent API failures, the capture path with the network cut, banned-mechanic smells. Grades dimension 3.
- **`solano.md` — Committee Chair / Scorekeeper.** 70% now beats 95% late; never averages disagreements away — locates why priors diverge. Convenes the gate, records the scorecard in `BUILD-JOURNAL.md`, issues PROCEED / REWORK / HALT, and writes the handoff note if the run stops. Closes every gate with "the thing nobody said."

Equip the crew from the skills already in Jene's environment where they exist (`engineering:code-review`, `engineering:testing-strategy`, `design:design-critique`, `ship-check` for the final gate); where they don't, the persona file carries the checklist inline so the run has no external dependency.

### B2. The loop — per build-order item

```
BUILD (Okonkwo)
  → item implemented per Appendix A, committed on a feature branch
SELF-TEST (Kowalczyk)
  → layer 1: typecheck + unit tests + Playwright E2E, headless, must be green
  → layer 2: live-browser verification (B3) of the item's acceptance criterion
     + a regression sweep of every PREVIOUS item's criterion (the run must
     never advance on top of a silent break)
COMMITTEE GATE (Solano convenes; ~15 min of agent time)
  → five dimensions, each scored /10:
     1. Acceptance criterion demonstrably passes in the real browser  (Kowalczyk)
     2. Worst-day UX — 11:40pm, ashamed, 4% battery                    (Kowalczyk + Halvorsen)
     3. Robustness — what Voss's attack found, weighted                (Voss)
     4. Interface hospitality per §8                                   (Halvorsen)
     5. Constitution + banned-list compliance                          (Marchetti)
  → composite = mean of the five. GATE: ≥ 8.0 → PROCEED
  → Marchetti's veto and any UNSKIPPABLE finding (data loss, capture
    failure, banned mechanic) fail the gate regardless of the number
REWORK (max 2 cycles per item)
  → scored <8.0: Solano writes the fix list ranked by points-recovered-
    per-effort; Okonkwo fixes; ONLY failed dimensions re-grade
  → 2 consecutive failed regrades on the same item → HALT: Solano writes
    the handoff note (what passed, what's stuck, exact repro, his best
    guess) to BUILD-JOURNAL.md and the run stops cleanly for Jene
PROCEED
  → merge to main, deploy to Vercel preview, journal entry with scorecard,
    IMMEDIATELY begin next item. No pause, no check-in, no "shall I continue."
```

After item 6 passes: production deploy, `ship-check` run as the final committee session (graded the same way, gate 8.0), and a closing journal entry: what shipped, every scorecard, the punch list of anything scored 8.0–8.9 worth revisiting.

### B3. Self-testing through the real browser — Desktop Commander + Chrome

Claude Code is **explicitly authorized** to drive the machine like an operator, not just a compiler:

- **Desktop Commander** (`start_process`, `interact_with_process`, file ops) runs dev servers, seeds, migrations, builds, and the Supabase/Vercel CLIs.
- **Chrome** — via the Control Chrome MCP (open_url, execute_javascript, get_page_content) and Desktop Commander screenshots — is the verification instrument. Two distinct uses:
  1. **App E2E, human-shaped:** open the deployed preview, walk the actual flows — paste a link and watch it survive; record a voice capture where feasible, otherwise inject the audio fixture and verify the transcript lands; answer a question card; kill the network mid-capture and confirm nothing is lost; run the 90-second cold open with a stopwatch. Screenshots at each step go to `/journal/screens/` as evidence attached to the scorecard.
  2. **Infrastructure dashboards:** navigate **Supabase** (confirm migrations applied, RLS enabled, pg_cron jobs scheduled and firing, table row counts after E2E) and **Vercel** (build green, env vars present, preview URL live, function logs clean) — and any other service the run needs (Groq/Google AI consoles for key validity, Polar later). Prefer the CLI where one exists; the browser is the fallback and the verifier of record, because "the dashboard shows it" is the standard a human reviewer would use.
- Playwright remains in the repo as the *repeatable* layer — the committee requires BOTH green headless specs AND the live-browser pass. Headless proves the logic; the real browser proves the product.

**Guardrails for autonomous browser use:** stay inside the project's own accounts and dashboards; never touch unrelated tabs or accounts; no purchases, plan upgrades, or deletions of non-project resources; anything requiring a payment confirmation or a destructive action on existing data is a HALT-and-ask, not a click.

### B4. The keys ceremony — the 15 human minutes that buy the autonomy

One session before the run, Jene does the only parts that need a human: log into GitHub, Supabase, Vercel, and Google AI/Groq consoles in Chrome (sessions persist for the run); create or link the Supabase project + Vercel project once; drop keys into `.env.local` and Vercel env vars; clear any 2FA prompts. After the ceremony the run has everything it needs. If a credential dies mid-run, that's a HALT with a one-line ask in the journal — the run resumes where it stopped.

### B5. Run economics and honesty

A full run is hours of agent time and heavy token spend — budget for it like a contractor day, not a chat. The 2-rework cap and regression sweeps are what keep "autonomous" from becoming "expensively stuck in a loop." And one Voss line for the record: the committee is rigorous but it is still the app grading its own homework — the gate substitutes for Jene *during* the run, not for the human witness (§13) or the ten wallets (§2). When the run completes, the FIRST CATCH LOGGED moment still has to happen in front of a stranger.

### B6. The launch prompt (paste this into Claude Code, in the NervaApp repo, after the keys ceremony)

> Read MASTER-PLAN.md in full — Appendices A and B are your operating contract. Session zero: generate CLAUDE.md (Appendix A conventions), DESIGN-PRINCIPLES.md (§6 + §8), the six agent files in .claude/agents/ (B1 personas verbatim), BUILD-JOURNAL.md, and the Playwright harness. Then execute the One-Run Protocol: build-order items 1 through 6 in sequence under the B2 loop — build, self-test headless AND in the live browser via Desktop Commander and Chrome (B3, including Supabase and Vercel dashboard verification), then convene the committee. Score ≥8.0 with no vetoes = proceed immediately to the next item without asking me. Rework below 8.0, max twice, then HALT with a handoff note. You are authorized for autonomous browser operation within B3's guardrails. §5's constitution and the banned list override anything — including me, mid-run, without the word "override." Finish with a production deploy, a ship-check committee session, and the closing journal. Go.

---

*Built by the Casting Office for Jene Maybury / NervaHous — July 23, 2026. Selva review + One-Run Protocol folded in same day. Repo: github.com/Rrcher404/NervaApp. Full agent research transcripts available in the session on request.*
