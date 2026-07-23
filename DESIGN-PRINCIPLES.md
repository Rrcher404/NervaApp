# DESIGN-PRINCIPLES.md

**Source: MASTER-PLAN.md §6 (gamification) and §8 (design direction). This file is law.**
Anything here overrides a feature request made in the moment, including one from Jene, unless
the literal word `override` is used.

---

## The design axiom

> Assume the user opens the app at **11:40pm, ashamed, three days absent, 4% battery.**
> Every mechanic is judged on that day.

---

## 1. BANNED FOREVER

These are not preferences. They are structural exclusions. A feature that smells like one of
these is rejected at the gate regardless of its score on every other dimension.

### 1.1 Breakable streaks — any form
Any resettable consecutive-day metric, **including streak-with-freezes.** The guillotine
existing is the problem, not how often it falls. For this audience the broken streak is the
last session.

### 1.2 Punishment mechanics
Hearts, decay, pet damage, red overdue badges — **any state that visually worsens through
inaction.** Habitica's damage model is the canonical ADHD failure case.

**Including wilting visuals.** Selva's drooping plants are its most charming mechanic and they
are banned here: state that worsens through inaction is punishment in disguise, whatever the
art style. For an ND research audience the wilt reads as another disappointed authority.

> **The Sieve ships the inversion: the Orchard.** Due question cards *ripen* toward harvest —
> colour deepens, fruit swells. An unharvested card simply **stays ripe.** Same glanceable SRS
> state, same tap-to-review, **zero decay signal.**
>
> **Ripen, never rot.**

### 1.3 Leagues and ranked comparison
Ambient co-presence ("3 people are sieving right now") is allowed later. Ranking never.

### 1.4 Guilt notifications
Absence is never rendered as a gap. No "we miss you," no "you've lost progress," no counters
of days missed.

### 1.5 Variable-ratio rewards
No loot boxes, no mystery rewards, no gambling schedules. Quest rotation is **deterministic and
date-seeded** — the same day produces the same quests. Reward magnitude is knowable in advance.

### 1.6 Unskippable celebrations
Any tap skips any celebration, from frame one. `prefers-reduced-motion` is honoured everywhere.

---

## 2. SHIPPED IN v1 — the five mechanics

**1. Bricks (lifetime counter).** Smallest unit of "did research" = one catch or one answered
card = one permanent brick. **Monotonic — no code path decrements it.** The data model does not
contain a reset state. Worst day: open, one tap, one sentence, brick minted, close. Three
interactions.

**2. Silent infinite grace + loud return ritual.** Absence is never rendered as a gap. Returning
triggers the **warmest screen in the app**: welcome, 30-second state restore, one suggested
micro-step. The relapse moment gets the most design attention because it is where ND tools go
to die.

**3. One Next Tile.** On open: exactly **one** lit suggested micro-action, derived from actual
state ("You caught this yesterday — turn it into one question?"). Free-roam escape hatch always
visible for hyperfocus. **One tap from open to working.**

**4. Quests from your own notes.** Rotating micro-quests generated from the user's material:
*"Two of your catches disagree — referee them." "This thread has no question yet — give it one."*
Novelty from **their** corpus, not our content mill. Unclaimed quests vanish without penalty or
residue.

**5. Hyperfocus harvest.** A session artifact that grows during a sprint; when the burst ends the
app banks it visibly ("14 connections in 90 minutes") with bonus bricks. Bursty output is the ND
signature — the system banks bursts instead of demanding evenness. **A 3-hour Tuesday visibly
outweighs five absent days.**

---

## 3. The emotional layer — the Dip

Kuhlthau's Information Search Process documents that research *feels bad in the middle*.
Uncertainty and anxiety spike during Exploration. **That is the documented shape of the work,
not a defect in the researcher.**

The app detects dip signals — source-thrashing, deletion spirals, long idles mid-project — and
surfaces a **named state**:

> *"You're in the Dip. This is stage three of six. It's supposed to feel like this."*

...with a 2-minute **dip-legal unit** (log three contradictions; don't resolve them).
**Floundering is never penalised, because floundering is the work.**

---

## 4. Celebration language

Hard-shadow stamps slamming onto paper — **FIRST CATCH LOGGED** — snappy, brutalist-native,
`prefers-reduced-motion` respected, 200–350ms.

**Formulation** (finding your angle) is the game's biggest milestone, celebrated harder than
finishing, because Kuhlthau found most people skip it and produce mush.

**The honest number leads.** Session-end reveal shows *connections made / questions answered*
first; bricks and XP follow. Any tap skips.
*"XP is screen-time; the honest number is comprehension."*

**System voice:** warm-dry, Marlow-adjacent, never chirpy. v1 ships **voice, not avatar.** A
visible companion is a v2 A/B, not a v1 bet.

---

## 5. Tokens — Brutalist Editorial

The aesthetic **is** the metaphor: research as a working press, catches as clippings, threads as
editions.

```css
--ground:  #EFEAE3;  /* parchment */
--ink:     #111110;
--accent:  #D8F21D;  /* acid chartreuse */
```

- **Accent is for state and celebration ONLY.** It must never be the sole carrier of meaning.
- **No red punishment states exist.** There is no danger colour, because there is no danger state.
- Every text/background pair passes **WCAG AA**. Pairs are listed and checked in the repo.

**Type — the two-voice rule:**

| Voice | Face | Carries |
|---|---|---|
| **Serif display** (Instrument Serif / Freight-adjacent) | the human's material | catches, answers, questions, meaning |
| **Grotesque** (Inter / Archivo) | body | UI copy, labels |
| **Mono** (IBM Plex Mono / JetBrains) | the machine talking | timestamps, system voice, citations, counts |

**The user always knows who is speaking.**

**Structure:** borders 2–3px solid ink · shadows hard-offset 4–6px, **no blur** · radius small
(2–6px) · celebration = stamp animations 200–350ms.

---

## 6. Brutalist-but-usable rules

- **Contrast is rationed.** One focal point per screen; calm reading surfaces inside loud chrome.
- **Hard borders double as affordance.** A bordered + shadowed element is pressable, unambiguously
  — good for ND parsing.
- **Generous whitespace** (24–32px+).
- **The acid accent never carries semantic weight alone.**

---

## 7. The interface commandments

1. **One dominant next action, always.**
2. **Never render a blank page.** Every empty state is pre-seeded with instruction or material.
3. **Capture costs zero decisions.** No title, no folder, no tag, no project picker at capture.
4. **Value before identity.** Full capture-and-sieve demo before any signup wall.
5. **Structure is the product, flexibility is the trap.** Opinionated containers. Customisation is
   a settings-page privilege, never the front door.
6. **Retrieval never depends on memory.** Search + resurfacing + suggested links.
7. **Guidance in the moment, never a 10-screen tour.**

---

## 8. The first 90 seconds — the cold open

| t | What happens |
|---|---|
| ~3s | Land on **one serif question**: *"What are you trying to figure out?"* One input, one acid button, **no nav** |
| — | They type a topic or paste a link/PDF. Mono ticker shows the sieve visibly working: *"reading… found 3 threads…"* |
| ~30s | App returns a pre-built expedition: **three cards + one spicy question** — first personalised meaning |
| ~75s | One lit action: open card 1, read 30 seconds, tap one reaction — first contribution at near-zero effort |
| <90s | Stamp slams: **FIRST CATCH LOGGED** (+XP) — and *only then*: "Save your expedition?" → signup |

**At no point before 90s:** a structural decision, a second primary action, or a blank page.
