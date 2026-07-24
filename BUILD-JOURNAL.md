# BUILD JOURNAL — The Sieve (NervaApp)

One-Run Protocol, per MASTER-PLAN.md Appendix B. Every committee gate lands here, chronological,
with the scorecard, the evidence trail, and the thing nobody said.

**Gate:** composite ≥ 8.0 across five dimensions → PROCEED. Marchetti veto or any UNSKIPPABLE
finding fails the gate regardless of number. Max 2 rework cycles per item, then HALT + handoff.

---

## Session Zero — 2026-07-23

**Run opened.** Environment recon, scaffolding, and the operating contract laid down.

**Recon findings:**
- `Rrcher404/NervaApp` existed on GitHub (public, empty — zero commits). Local dir was not a git
  repo; initialised on `main`, remote wired.
- Vercel CLI authed (`rrcher404`). GitHub CLI authed. Supabase MCP authed → org **NervaHous**
  (free plan, $0 for a new project).
- **B4 keys ceremony had NOT happened:** no `.env.local`, no Supabase project for the Sieve, no
  Gemini/Groq/OpenAI keys on disk anywhere for this app. Decision: proceed — item 1 is
  local-first by law and needs zero cloud; a Supabase project can be created via MCP when item 1
  needs auth+persistence. AI keys become a blocking ask no later than item 2 (transcription) /
  item 3 (embeddings). The run will HALT with a one-line ask if keys are missing when first
  needed, per B4.

**Session zero artifacts:**
- `CLAUDE.md` — Appendix A conventions, the constitution, the laws
- `DESIGN-PRINCIPLES.md` — §6 banned list + §8 interface commandments, verbatim
- `.claude/agents/` — okonkwo, kowalczyk, halvorsen, marchetti, voss, solano (B1 personas)
- `BUILD-JOURNAL.md` — this file
- Next.js scaffold (Next 16.2.11 / React 19.2.4 / Tailwind 4 / TS strict)
- Playwright harness

---

## Item 1 — Scaffold + capture · 2026-07-23 · **HALT**

**Acceptance criterion:** a pasted link survives airplane mode and appears cited when back online.
**Status: criterion PASSES. Gate FAILS.** Two consecutive failed regrades → HALT per B2.

### Final scorecard

| Dim | What | Grader | Score |
|---|---|---|---|
| 1 | Acceptance criterion in real browser | Kowalczyk | **9**/10 |
| 2 | Worst-day UX | Kowalczyk **4** / Halvorsen **8** | **4**/10 |
| 3 | Robustness | Voss | **6**/10 |
| 4 | Interface hospitality | Halvorsen | **9**/10 |
| 5 | Constitution + banned list | Marchetti | **10**/10 |
| | | **Composite** | **7.6** |

**Constitution: CLEAR.** Marchetti verified bricks append-only *mechanically*, not by reading the
comment — inserted a real brick, then ran UPDATE, DELETE and TRUNCATE as `postgres` (the table
owner, RLS-bypass-capable). All three raised `P0001: bricks are append-only`. No path to defeat it
exists short of DDL, and no such statement exists in either migration.

**On the dimension-2 divergence (Kowalczyk 4, Halvorsen 8):** not averaged. The priors diverge on
information, not perspective — Kowalczyk probed the new cross-tab dedupe path and found a data-loss
bug; Halvorsen did not test that path. Strictly more information governs. **4 stands.**

### Why the gate failed

**UNSKIPPABLE — data loss, introduced BY rework cycle 2.** `addCatch()` in `lib/store.ts` dedupes
on exact `rawContent` within a trailing 2000ms window, globally, across tabs. It cannot distinguish
a deliberate repeat from a double-submit. Type "wait", submit, pause a second, type "wait" again,
submit — one catch lands. The dropped capture *still clears the textarea and fires the "Catch
logged" stamp.* Targeted precisely at short, repeated, anxious fragments: the worst-day user's most
likely input. Reproduced single-page, no console tricks.

This is the finding that matters most in the whole run: **the fix for a MEDIUM finding
(cross-tab duplicates) introduced an UNSKIPPABLE one.** The 2-cycle cap exists for exactly this
signal — an error rate on this surface high enough that a third swing is not obviously convergent.

### Run history

- **Initial gate:** FAILED. Voss found the sacred write had `try/finally` with **no `catch`** —
  a rejected IndexedDB write lost the capture silently. Plus live-confirmed SSRF on `/api/enrich`
  (loopback, decimal-encoded loopback, external→internal 302) and a sweep race that reverted cited
  catches to raw.
- **Rework 1 → regrade:** FAILED. Sacred write, SSRF, sweep race, cross-tab, migrations export, IDB
  timeout all fixed and regression-tested. Dims 2 (6), 3 (not yet regraded), 4 (7) still under 8.
- **Rework 2 → regrade:** FAILED. Five WCAG failures cleared, false affordance removed, two-voice
  corrected, in-flight state added, status honesty added — and the dedupe UNSKIPPABLE surfaced.

### What shipped and is verified good

- 50 E2E specs green on **Chromium and real WebKit** (not a resized Chromium — verified).
- Capture survives airplane mode, mid-write network cut, total API death, hanging requests, 200KB
  paste, hostile input. Interaction count from cold open to logged catch: **3**.
- SSRF guard defeats 11 live payload classes: raw/decimal/octal/short-form loopback, IPv4-mapped
  IPv6, `169.254.169.254`, and live redirect chains.
- Supabase schema applied, RLS on every table, zero security advisors, migrations exported to
  `supabase/migrations/` and reproducible from source control.
- Every rendered text node passes WCAG AA, guarded by a spec that computes real ratios from
  computed styles (resolving Tailwind 4's `oklab()` through a canvas).
- Zero banned mechanics. No streak, no decay, no ranking, no guilt copy, no variable-ratio reward,
  no unskippable celebration. No red exists in the design system because no danger state exists.

### The thing nobody said

Every persona graded this as a capture feature. None of them said the quieter thing: **the two
worst bugs in this item were both introduced by a fix, not by the original build.** The missing
`catch` block was written by someone adding a mutex; the dedupe data-loss was written by someone
closing a duplicate-capture finding. The committee is very good at finding defects in code that was
*built*, and measurably worse at anticipating defects in code that was *repaired* — which is
precisely where an ND builder at hour nine is most likely to be operating. The regression suite grew
by 26 specs across two cycles and still didn't catch the dedupe bug, because tests written to close a
finding inherit that finding's blind spot. Whatever gets built next, the rework diff deserves a
harder adversarial pass than the original diff, not a lighter one.

---

## HALT — Handoff note (Solano)

Written for someone arriving cold, tired, with no memory of this run.

**What passed:** Session zero complete and committed. Item 1's acceptance criterion demonstrably
passes in a real browser on two engines. Constitution CLEAR. Interface hospitality 9/10. Everything
is on `main` at `Rrcher404/NervaApp`, pushed.

**What's stuck:** Item 1's gate, on a data-loss bug my own rework introduced. Composite 7.6, and an
UNSKIPPABLE that fails the gate regardless of the number.

**Exact repro (60 seconds, no tooling):**
```
npm run dev
# open http://localhost:3000
# type: wait     → click "Catch it"
# wait ~1 second
# type: wait     → click "Catch it"
# → only ONE catch in the list. The second cleared the box and stamped "Catch logged".
```

**The fix list, ranked by points-recovered-per-effort.** Every one has an exact location.

1. **[UNSKIPPABLE] `lib/store.ts` → `addCatch()`.** Remove the content-based dedupe entirely. It
   cannot distinguish a deliberate repeat from a double-submit, and the same-tab case is already
   covered by `submittingRef` in `Capture.tsx`. Keep `navigator.locks` for serialisation only.
   Then make `addCatch` return whether it actually wrote, and only fire the stamp when it did —
   a celebration must never fire over a discarded capture.
2. **[HIGH] `lib/store.ts` → `addCatch()`.** `navigator.locks.request()` has no timeout, and the
   dedupe does a full-table `getAll()` inside the lock. Five rapid captures serialised into an 8+
   second disabled button; only 2 of 5 landed before the click timed out. This breaks the
   hyperfocus-harvest pattern, which is a flagship mechanic. Removing the dedupe (fix 1) removes
   the `getAll()`; add an `AbortSignal` timeout to the lock request regardless.
3. **[HIGH] `lib/store.ts` → `openDb()`.** `dbPromise = null` is missing from two of four failure
   paths: the synchronous-throw `catch` block and `req.onerror`. The sync-throw branch is the
   Safari-private-mode case its own adjacent comment names. Consequence: the user is told "try
   again", clicks exactly as instructed, and it fails for the rest of the tab's life because the
   rejected promise is still memoised. Two lines, both branches, pattern already correct in the
   timeout and `onblocked` branches.
4. **[MEDIUM] `components/Capture.tsx` → `sweep()` catch branch.** The network-exception path sets
   `status: "raw"` without `statusFromAttempts: true`, so a hard fetch failure freezes the label at
   "couldn't reach it — retrying (5/5)" forever, claiming an active retry that `pendingEnrichment()`
   has permanently stopped attempting. Add the flag.
5. **[MEDIUM] `lib/sieve/extract.ts` → DNS rebinding.** `assertPublicHost()` resolves, then `fetch()`
   re-resolves the hostname string independently. An attacker's nameserver can answer the safety
   check and the real connection differently, deterministically. Resolve once, connect to the
   validated IP with the Host header preserved (custom dispatcher). Opportunistic SSRF is fully
   closed; this is the deliberate-infrastructure case.
6. **[LOW] `components/Capture.tsx` → `sweep()`.** Its IndexedDB reads have no catch, so a broken
   store throws an unhandled rejection every 15 seconds, unbounded. Same root cause as fix 3.
7. **[LOW] Placeholder text is `ink/50` = 3.40:1, still failing AA** — and `tests/e2e/a11y-contrast.spec.ts`
   cannot see it, because `::placeholder` is a pseudo-element and never a child text node. Fix both:
   raise the token, and probe `getComputedStyle(el, '::placeholder')`. A guard that reports clean
   while a real failure sits on the page is worse than no guard.
8. **[LOW] `components/Capture.tsx`.** The `storage-down` and `save-error` boxes still carry
   `shadow-hard` — the same false-affordance pattern just removed from catch cards. Both are inert.

**Two rework attempts tried:** Cycle 1 closed the sacred-write UNSKIPPABLE, SSRF, the sweep race,
cross-tab duplicates, the migrations-export gap, and the IDB open timeout — all with regression
tests. Cycle 2 closed five WCAG failures, the false affordance, the two-voice violation, the missing
in-flight state, and the dishonest "still sieving" limbo. Both regrades still landed under 8.0, and
cycle 2's cross-tab fix is what introduced the UNSKIPPABLE.

**My best guess:** fixes 1–3 are roughly thirty minutes and should move dim 2 from 4 to ~8 and dim 3
from 6 to ~8, putting the composite near 8.6. The whole item is close. It is stuck on a fix, not on
a design problem — nothing here suggests the architecture is wrong.

**Unblocked by (what Jene needs to decide or do):**
1. **Authorise a third rework cycle on item 1**, or accept the fix list and re-gate in a fresh
   session. The protocol stopped the run; only you can restart it.
2. **API keys for items 2–4.** Nothing for this project exists on disk. Jene pointed to an iCloud
   note containing Gemini and OpenAI keys — deliberately not opened during this run, since items 2–4
   were not reachable anyway and credentials should be placed by hand. Drop `GEMINI_API_KEY` and
   `OPENAI_API_KEY` (and `GROQ_API_KEY` if one is wanted for faster transcription) into `.env.local`.
   Without them: item 2 has no transcript, item 3 has no embeddings, item 4 has no question cards.
3. **Note:** the `the-annex` Supabase project was **paused** (with Jene's explicit approval) to free a
   free-tier slot for `the-sieve` (`hwvftktrcxhjwovplfpf`, us-east-1). The Annex's backend is down
   until it is restored from the Supabase dashboard.

**One line for the record, per B5:** the committee is rigorous but it is still the app grading its
own homework. It stopped a real data-loss bug from shipping today, which is the point. It does not
substitute for the human witness (§13) or the ten wallets (§2). FIRST CATCH LOGGED still has to
happen in front of a stranger.

---

## Process review — the three questions (2026-07-23, post-HALT)

Jene asked three questions after authorising rework cycle 3. They are answered here as
changes, not opinions.

### 1. What is the best way to address the issues found?

**Fix the class, not the instance.** Every finding in this run had a general form, and
fixing only the specific case is how the same bug returns wearing different clothes.

| Instance | The class | What was actually done |
|---|---|---|
| Dedupe dropped deliberate repeats | A *heuristic* was answering an *identity* question | Removed it. Identity questions get structural answers (an in-flight guard on one gesture), never content-matching-within-a-window. Heuristics that discard user data are always wrong. |
| Example tests passed while data was being lost | Tests written to close a finding inherit that finding's blind spot | Property-based tests asserting the invariant (`persisted == submitted` for any sequence), **mutation-tested** — reintroduce the bug, watch the suite fail, restore |
| Contrast guard reported clean over a real failure — twice | A guard that has never been *seen to fail* is decoration | Guards now require a mutation test. The constitution check ships with a probe proving it trips on all 8 violation types. |
| Constitution lived in a markdown file | A document cannot enforce anything at 2am | `scripts/constitution-check.mjs` — a machine gate in CI and `npm run gate` |

**The rule that came out of it:** *a guard with no failing test is decoration.* Applied to
the property suite, the constitution check, and the contrast guard — all three have now
been observed failing on purpose.

### 2. What does a real review team look like, and does the agent stack align?

It did not. Mapping the B1 crew onto the roles a real team fills:

| Real role | B1 crew | Status |
|---|---|---|
| Feature engineer / tech lead | Okonkwo | ✅ |
| QA engineer | Kowalczyk | ✅ |
| Accessibility + design critique | Halvorsen | ✅ |
| Product owner / acceptance | Marchetti | ✅ |
| Engineering manager / release | Solano | ✅ |
| Security engineer | Voss | ⚠️ doing three jobs |
| Reliability / SRE | — | ❌ **missing** |
| **Peer code reviewer** | — | ❌ **missing** |
| Automated CI gate | — | ❌ **missing** |

**The code-reviewer gap has a body count.** The missing `catch` block that caused the HALT
passed every test — necessarily, because a missing `catch` has *no behaviour to exercise*.
It was obvious on **reading**. Nobody owned reading. Added `nakamura.md`; on his first pass
he found four real bugs including a type cast hiding a crash that would have silently
disabled the SSRF guard.

**The reliability gap becomes critical at item 3**, when pg_cron and the sieve queue start
running unattended — the exact failure the plan already predicts (§9). Added `adeyemi.md`,
who also permanently owns **the rework diff**, the seat that was empty when cycle 2 shipped
a worse bug than it fixed.

**The machine gap** is now `.github/workflows/gate.yml` + `npm run gate`: constitution
check, typecheck, lint, property tests, build, E2E on Chromium and WebKit, dependency
audit. It runs on every push, costs no agent tokens, and has no opinions to be argued out
of at 2am.

### 3. Which available plugins assist this project?

Adopted or scheduled, in order of value:

1. **Context7 / library-docs MCP — adopt immediately, standing rule.** `AGENTS.md` says it
   outright: *"This is NOT the Next.js you know."* Next 16 post-dates the model's training,
   and this run already lost time to a `turbopack.root` config that broke the dev server.
   **Pull the docs before writing framework code; do not reason from memory.**
2. **`security-review`** — the SSRF bypass was found by an agent improvising. A dedicated
   pass belongs in the gate before any production deploy.
3. **`engineering:code-review`** — equips Nakamura's seat with a real checklist.
4. **`engineering:testing-strategy`** — named in B1; belongs to Kowalczyk.
5. **`design:accessibility-review`** — belongs to Halvorsen; the contrast guard has been
   wrong twice and deserves a second opinion.
6. **`hookify`** — the sleeper. A pre-commit hook running `constitution-check.mjs` turns
   §5 from a document a tired builder can talk past into something that *cannot be
   committed*. This is §13's witness pattern, mechanised.
7. **`anthropic-skills:ship-check`** — the plan names it for the final gate (B2).
8. **Vercel MCP + `vercel:deployments-cicd`** — for the production deploy and preview URLs.
9. **`product-tracking-skills`** — for the append-only `events` table in §12, when the
   metrics that have decision authority get instrumented.

---

## Item 1 — Scaffold + capture · 2026-07-23 · **PROCEED** (after re-authorisation)

The run HALTED once (above). Jene re-authorised a third rework cycle and a harder adversarial
pass. Three more review rounds followed. Final gate:

| Dim | What | Grader | Score |
|---|---|---|---|
| 1 | Acceptance criterion in real browser | Kowalczyk | **9**/10 |
| 2 | Worst-day UX | Kowalczyk + Halvorsen | **9**/10 |
| 3 | Robustness | Voss | **8**/10 |
| 4 | Interface hospitality | Halvorsen | **10**/10 |
| 5 | Constitution + banned list | Marchetti | **10**/10 CLEAR |
| | | **Composite** | **9.2** |

**Zero UNSKIPPABLE. Constitution CLEAR. Gate: PROCEED.**

### What the extra rounds bought

Cycle 3 fixed the HALT's UNSKIPPABLE **by removal** — the content dedupe was a heuristic
answering an identity question and could not tell a deliberate repeat from a double-fire.
Deleted; Voss's original cross-tab finding formally DECLINED (a duplicate catch is cosmetic,
a dropped catch is constitutional), and he accepted the reversal.

The harder pass then found, and closed, three bugs that had survived the earlier rounds:
- **A live SSRF bypass.** `http://[::ffff:127.0.0.1]/` reached an internal decoy through both
  guard layers — the URL parser canonicalises it before any regex sees it. Replaced text
  matching with numeric hextet parsing across the whole `::ffff:0:0/96` range, NAT64, ULA and
  link-local. Voss's ~25-case torture battery could not break the replacement.
- **The openDb fix was being clobbered by assignment ordering** — `dbPromise = null` inside a
  Promise executor runs before the outer assignment completes. `indexedDB.open()` now happens
  before the memo exists. Verified: the retry count now climbs 2→3→4.
- **`sweep()` had reacquired the try/finally-with-no-catch shape that caused the HALT.**

### New this item, carried forward

- **Nakamura (code reviewer)** and **Adeyemi (reliability)** seats added — the two roles whose
  absence let the HALT's bug through. Nakamura found the `as never` cast hiding a crash that
  would have silently disabled the SSRF guard.
- **Property-based test suite** (fast-check) asserting `persisted == submitted` for any capture
  sequence. Mutation-tested: reintroduce the dedupe bug → suite fails.
- **`scripts/constitution-check.mjs`** + pre-commit hook + CI — the banned list as a machine
  gate. Voss found and I closed its one real hole (it missed the Supabase client's chained
  `.from("bricks").delete()` form; SQL-keyword-first only). Now covers both.

### Punch list (scored 8.0–8.9 territory, revisit — NOT blocking)

- No service worker / offline app shell → a cold launch while already offline hits the browser
  error page. **v0.5 scope** (MASTER-PLAN §14), costs a point on dim 2, tracked not fixed.
- `unsyncedCatches()` and `lib/supabase/*` are scaffolding with no caller yet — wire or remove
  when sync lands.
- Error-banner recovered text is not one-tap restorable to the box (Halvorsen) — add a "restore"
  affordance.
- The contrast guard has no live opacity counterexample left in the app (the only one was
  removed) — keep a synthetic case so the compositing code stays proven.

### The thing nobody said

Across four rounds and three rework cycles, **every single serious bug in this item was
introduced by a fix, not by the original build** — the missing catch, the dedupe data-loss,
the clobbered retry, the reacquired try/finally. The original capture code was close to right
the first time; the danger was always in the repair. That is the empirical case for Adeyemi's
seat and for the rule now written into it: *review the fix harder than the feature.* The next
five items will be judged the same way, and the rework diffs harder than the feature diffs.

---

## Item 1 — LIVE on production · 2026-07-23

Deployed to Vercel. Public production URL: **https://the-sieve.vercel.app**
(project `the-sieve`, org solhous; the deployment-specific URL is Vercel-auth-walled by
default, the canonical production alias is public.)

**B3 live verification, on the real URL, not localhost:**
- Cold open renders the parchment/ink/acid surface; disabled "CATCH IT" button correctly
  shows without the accent (the contrast fix is live).
- Pasted `https://en.wikipedia.org/wiki/Zettelkasten` → the SSRF-guarded serverless
  `/api/enrich` ran on Vercel's Node runtime (undici dispatcher works there) and returned
  **"Zettelkasten - Wikipedia · CITED — EN.WIKIPEDIA.ORG"**. Acceptance criterion passes in
  production.
- Env vars set on Vercel: Supabase URL + anon key, plus Gemini + OpenAI keys staged for item 2.

A stranger could reach this URL now and log their first catch. The §2 gate (ten wallets) and
the §13 witness still stand outside the run — but the FIRST CATCH LOGGED moment now has a URL.

---

## Interlude — a deeper look at the grading process (think piece)

Jene asked, mid-run, what the committee actually *is* underneath the scorecards. Worth
answering honestly, because the mechanism turned out to matter more than any single number
it produced.

**The committee is not a quality checkbox. It is a disagreement engine.** Its entire value
is that the personas are built to notice *different* things and to refuse *different* things.
Kowalczyk feels a UI as a cost-per-tap; Halvorsen reads it for who it thinks it's talking to;
Voss reads what the diff is silent about; Marchetti reads it as a transfer of labour;
Nakamura reads it as text, not behaviour. Point five people with the same taste at a diff and
you get one opinion five times. Point five *different* refusals at it and the blind spots
stop overlapping. Every real bug this run surfaced landed in exactly one persona's lane and
was invisible to the other four.

**The number is the least important output.** Item 1's composite walked 7.6 → HALT → 9.2, and
the digits explain nothing. What the run actually produced was a *list of specific failures a
tired solo builder would have shipped*: a sacred write with no catch block, a live SSRF
bypass, a data-loss dedupe that fired the success stamp over a discarded thought, an iOS Blob
bug hiding behind a green Chromium suite. None of those were caught by "is it good?" They were
caught by five narrow, hostile, *specific* questions asked in parallel. The gate's job is to
convert a vague feeling of doneness into an enumerated punch list. The 8.0 threshold is just
the tripwire that decides whether the list is short enough to ship.

**The most important finding was structural, and nobody was assigned to find it.** Every
serious bug in item 1 — all four — was introduced *by a fix*, not by the original build. The
capture code was close to right the first time; the danger lived in the repair, made under
time pressure, in code no longer read with fresh eyes. The committee is excellent at grading
code that was *built* and was measurably worse at anticipating defects in code that was
*repaired* — which is precisely where a hyperfocused ND builder at hour nine operates. That
observation is why two seats were added mid-run: Nakamura (reads the diff as text, because the
missing catch block had no behaviour to test and was obvious on *reading*) and Adeyemi (owns
the rework diff every cycle, because the seat that should have caught the dedupe regression was
empty). The process improved itself by watching itself fail. That is the part worth keeping.

**The honest limit, stated in the plan and re-stated here (Voss's line for the record):** the
committee is rigorous but it is still the app grading its own homework. It substitutes for
Jene *during* a run. It does not substitute for the human witness (§13) or the ten wallets
(§2). It stopped a real data-loss bug from reaching a stranger today — which is the entire
point — but FIRST CATCH LOGGED still has to happen in front of a stranger who was never in
the room.

**Evidence, this run:**
- `journal/screens/item1-01-cold-open-empty-state.png` — never a blank page
- `journal/screens/item1-02-offline-first-catch-logged-stamp.png` — the stamp lands offline
- `journal/screens/item1-04-back-online-cited.png` — a link cites itself on reconnect
- `journal/screens/item2-01-record-button.png` — the voice affordance, one tap
- `journal/screens/item2-02-transcribed.png` — transcript in serif, provenance in mono
- Full narrative how-to: `journal/committee-process.html`

---

## Item 2 — Voice + scraping · 2026-07-23 · **PROCEED**

**Acceptance criterion:** a 60s voice ramble becomes a cited, transcribed catch.
**Verified LIVE** on production (the-sieve.vercel.app): real speech POSTed to /api/transcribe
returned a verbatim transcript via Gemini native audio. Two rework cycles; final gate:

| Dim | What | Grader | Score |
|---|---|---|---|
| 1 | Acceptance criterion (real browser / live endpoint) | operator* | **9**/10 |
| 2 | Worst-day UX | Halvorsen | **9**/10 |
| 3 | Robustness | Voss | **8**/10 |
| 4 | Interface hospitality | Halvorsen | **9**/10 |
| 5 | Constitution + banned list | Marchetti | **10**/10 CLEAR |
| | | **Composite** | **9.0** |

*\*Dim 1 operator-graded, not persona-graded: Jene stopped the Kowalczyk agent mid-run and it
could not be resumed. With Jene's explicit decision, dim 1 was scored from live production proof
(the endpoint returns a verbatim transcript) + 102 E2E specs covering the flow on two engines,
rather than relaunching the grader. Recorded honestly as an operator verification.*

**Constitution: CLEAR.** Marchetti classified transcription and Readability both as clerical
(dictation, boilerplate-removal), verified the transcribe prompt is verbatim-only at
temperature 0, and confirmed nothing ghostwrites.

### The deviation, and why it's more on-plan than the plan

Plan §9 names Groq whisper primary + OpenAI Whisper fallback. At build time there is no Groq
key, the OpenAI key is out of quota, and the plan's `gemini-2.5-flash-lite` is deprecated
(Jul 2026, Gemini 3.x is current). Gemini transcribes audio natively and verbatim (verified
end-to-end), and consolidating transcription onto Gemini honours §9's **stronger** principle —
"one vendor, one SDK, one bill" — better than a three-vendor stack. Gemini primary; Groq +
OpenAI light up automatically if keys appear. Model pinned to `gemini-flash-lite-latest` so it
can't go stale the way a pinned 2.5 did.

### Two rework cycles — the honest record

- **Initial gate:** dims came in 9/9/5/7/10 with a ~20-item fix list across four graders.
- **Rework cycle 1:** fixed the lot — recording durability (draft + 3s flush + crash
  recovery), all mic-stream leaks (double-tap, unmount-during-grant, throw-on-start,
  guarded stop), the Readability hang, the body-DoS, the voice-blind never-downgrade guard,
  the transcribe timeout budget + Gemini-first order, the sweep round-robin, the articleText
  wire-through, audio playback, and the contrast guard's recording-state blind spot.
  Regrade: Halvorsen 9/9, Marchetti stood — **but Voss dropped dim 3 to 4**, proving both my
  DoS "fixes" were naive and still live.
- **Rework cycle 2 (the cap):** the DoS fixes done properly. The Readability depth guard was
  defeated by `<div></span>` (an unmatched close tag the regex counted, undercounting to
  "safe" while the real DOM was 1500 deep) → replaced with a walk of the actual parsed tree.
  The Content-Length check was a no-op against chunked transfer → replaced with a streaming
  byte-counter (`readBodyCapped`) that aborts mid-stream regardless of headers, now also
  time-bounded. The flush/finalize race → a guarded single-transaction write that no-ops once
  finalised. Regrade: **Voss 8, both HIGHs verified closed** (21,778ms → 9.2ms; +1.5GB → +37MB).

### The thing nobody said

Item 1's lesson was "every serious bug was introduced by a fix." Item 2 sharpened it: **the
committee caught a fix that was itself naive — twice in one finding.** My first DoS patches
*looked* like fixes, passed a green suite, and were defeated by two characters and a missing
header. The gate's value wasn't the 9.0; it was Voss refusing to accept a plausible-looking
fix and re-running the exact attack that beat it before. The generalizable rule, now proven
twice: **a fix for a security finding must be verified by re-running the original exploit, not
by reading the patch.** That belongs in Adeyemi's checklist as a hard requirement, not a
suggestion. Voss's parting MEDIUM (the read had a byte cap but no time cap) was closed before
this entry was written — the same instinct, applied one turn early.

### Punch list (non-blocking, revisit)

- The 3s flush window means a hard instant-kill can lose the last ~3s of a ramble — the honest
  ceiling for anything in a browser tab (Halvorsen). `pagehide` is best-effort, not a guarantee.
- Mic-denied copy reassures + offers the type fallback but doesn't name concrete permission steps.
- The Gemini "verbatim" transcription is enforced by prompt discipline + temperature 0, not by
  architecture (Marchetti) — a spoken adversarial instruction rides the same channel. A bad
  transcript sits visibly wrong on the card, never trusted downstream, but it's a watch item.

---

## Item 3 — Threads + human override · 2026-07-23 · **REWORK 1**

| Dim | What | Grader | Score |
|---|---|---|---|
| 1 | Acceptance criterion in real browser | Kowalczyk | **8**/10 (stands) |
| 2 | Worst-day UX | Kowalczyk + Halvorsen | **8**/10 (regrade, was 6) |
| 3 | Robustness / reliability | Voss + Adeyemi + Nakamura | **7**/10 (regrade, was 6) |
| 4 | Interface hospitality | Halvorsen | **8**/10 (regrade, was 6) |
| 5 | Constitution + banned list | Marchetti | **8**/10 (stands) |
| | | **Composite** | **7.8** |

**Verdict: REWORK 1.** Composite 7.8 < 8.0. No UNSKIPPABLE, no Marchetti veto — this is a
number miss on one dimension, not a fail-regardless.

### Why dim 3 is a 7 and not the 8 the mean would hand you

Three graders folded into dim 3. Voss attacked the override as a hostile second user and it
**held** (INVOKER + RLS + DEFINER owner-guard trigger, three live cross-user attacks all
refused) — 8. Nakamura read the rework diff and found no serious bug introduced by a fix — 8.
Adeyemi attacked observability and found a **live HIGH**: the every-2-minute sieve-drain — the
workhorse the rework built to replace the open-tab dependency — has no heartbeat, and run 1 was
proven to receive an HTTP 404 while `cron.job_run_details` recorded it `succeeded / "1 row"`. A
permanently-broken drain is indistinguishable from a healthy one at every place an operator looks.

They are not disagreeing about the artifact. Voss looked at the *security* of the override
(clean). Nakamura looked at *code correctness* (clean). Only Adeyemi looked at *whether the new
background machinery can fail silently* — and it can, provably, today. Averaging 8/7/8 to an 8
would erase the one lane that examined the surface the whole rework rests on. The binding
constraint is the HIGH. **Dim 3 = 7.**

### Fix list — ranked by points-recovered-per-effort (only dim 3 regrades)

Target: lift dim 3 from 7 → 8. Adeyemi named the exact bar: *drain instrumented to the audit's
level + one annunciation path that reaches a human.*

1. **Drain heartbeat (closes the HIGH — highest points/effort).** Add a `drain_runs` row per
   invocation (started_at, completed_at, users, batches, failed), symmetric with `audit_runs`,
   and have a check alert when no successful drain completed in ~10 min. Small table + one
   insert; it is the single blocker holding dim 3 at 7. *~30 min.*
2. **One real annunciation path (closes the MEDIUM, second half of the 8 bar).** The dead-man
   currently only `raise warning` into a Postgres log nobody reads. Replace with an active
   signal — insert an alerts/events row a monitored channel reads, or `net.http_post` to a
   webhook. Add one external (non-pg_cron) uptime ping so scheduler-death can't silence watcher
   and watched together. *~30 min.*
3. **Paginate audit user-discovery (MEDIUM).** `from('threads').select('user_id')` caps at
   ~1000 rows in PostgREST; past ~1000 threads the audit silently covers a subset and reports
   `error=null`. Use a distinct-user query/keyset and record `users_seen vs users_total`. *~20 min.*

### Carried forward (not dim-3 blockers this cycle — passed dims stay scored as-is)

- **Silent override failure (MEDIUM, dim 2 + Nakamura, convergent).** `ThreadsView.act()` calls
  `router.refresh()` only on success and does nothing on failure — no error state, no retry. On
  the worst day the human taps "not here", the POST fails offline, and the UI gives zero feedback.
  This is the exact silent-failure pattern the rework was praised for fixing in `ThreadsSync`,
  reintroduced one layer up. Dim 2 held at 8 (MEDIUM, no data loss — the catch stays put), but
  it lands on the punch list for the next item, not "someday".
- **Pipeline comment lies (MEDIUM, Nakamura).** `pipeline.ts:24` says "Every failure is recorded
  to the events table, never silently swallowed" — only the embed path logs; the embedding-write
  and assign-RPC error paths `failed++` and persist nothing. Make the code match the sentence.
- **Determinism contradiction (flag for dim 1, NOT regraded this cycle).** Halvorsen's run
  returned `ACCEPTANCE: FAIL` on the determinism assertion (re-sieve not identical), while
  Kowalczyk's dim-2 run reported `ACCEPTANCE PASS` and two graders (Adeyemi, Nakamura) could not
  run the script at all — Gemini 429 quota during seeding. Dim 1 stands at 8 per the regrade
  rule, but its certificate rests on a run at least one grader watched FAIL and two could not
  reproduce. If the cert is load-bearing, re-run it green on a funded key before Item 4 leans
  on it. Recorded honestly, not re-scored.
- **resolve_merge deletes spaced-repetition cards (LOW, latent).** `question_cards.thread_id`
  CASCADEs on the deleted thread and is never re-pointed. Harmless only because question_gen
  doesn't create cards yet. Land the re-point before question generation ships.

**Constitution: CLEAR.** Marchetti stands at 8. No banned mechanic: a failed override loses no
data, the machine never silent-reassigns, a reload shows truth.

### The thing nobody said

Every lane found the same defect and each filed it under a different name. Kowalczyk called it
"silent sync failure, now fixed." Then Adeyemi found the drain fails silently, Nakamura found the
pipeline swallows two of three error paths under a comment swearing it never does, and Kowalczyk
*themselves* found the new override actions fail silently — all in the same rework that was
celebrated for adding the `ThreadsSync` retry surface. Nobody said it plainly: **the retry surface
wasn't a fix, it was a fig leaf. The team learned the specific lesson — this one sync path — and
not the general one — surface every failure — so the moment they built three new things (the
drain, the override controls, the pipeline), all three went dark exactly the way the sync path
used to.** This codebase has a standing disposition to swallow errors, and the `pipeline.ts:24`
comment is the tell: someone wrote the aspiration out loud and then didn't hold the code to it
three lines later. The dim-3 HIGH will get patched next cycle. The disposition won't, unless
someone names it as the class instead of chasing it one instance at a time.
