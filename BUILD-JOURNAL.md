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
