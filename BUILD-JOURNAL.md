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
