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
