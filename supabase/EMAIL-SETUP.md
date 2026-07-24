# Transactional email for Supabase Auth — DONE (2026-07-24)

> The Sieve is anonymous-first: a stranger reaches FIRST CATCH LOGGED with no account, then
> hits "Save your expedition?" → magic link. That email **is the door.** It previously ran on
> Supabase's default service (~2–4 sends/hr, spam-prone) and would have silently killed
> concentrated signups. This is now wired to a real transactional provider and verified
> end-to-end. Project ref: `hwvftktrcxhjwovplfpf`.

## What was configured

**Provider: Resend over SMTP.** Used the already-verified sending domain `send.solhous.com`
(SPF + DKIM verified, Amazon SES infra). No new domain/DNS work was needed.

- **Custom SMTP** (Auth → Emails → SMTP Settings), enabled:
  - Host `smtp.resend.com`, Port `465`, Username `resend`
  - Password = Resend API key `supabase-the-sieve-smtp` (sending-only, scoped to the
    `send.solhous.com` domain; revocable in the Resend dashboard)
  - Sender `hello@send.solhous.com`, Sender name **The Sieve**
  - Min interval per user: 60s
- **Auth email rate limit**: auto-raised to **30/hour** on enabling custom SMTP
  (Auth → Rate Limits to raise further before a launch push; Resend free tier = 100/day).
- **Branded template** ([`templates/magic-link.html`](templates/magic-link.html)) applied to
  **both** templates, subject "Your link into The Sieve":
  - **Confirm sign up** — new users (the first-stranger "Save your expedition" moment)
  - **Magic link or OTP** — returning sign-ins
- **URL Configuration** (was the other silent prod-breaker — Site URL was `localhost:3000`
  and the redirect allowlist was empty, so prod magic links would have bounced users to their
  own localhost):
  - Site URL → `https://the-sieve.vercel.app`
  - Redirect allowlist → `https://the-sieve.vercel.app/**` and `http://localhost:3000/**`

## Verification (2026-07-24)

Real magic link sent from the live production `/login` to a Gmail address:
- Resend log: **delivered**, From `"The Sieve" <hello@send.solhous.com>`,
  `redirect_to=https://the-sieve.vercel.app/auth/callback` ✓
- Human-confirmed: landed in the **Gmail inbox** (not spam), link completed
  `/auth/callback → /home` **signed in** ✓

## Still open

1. **Outlook/Hotmail deliverability** — not yet tested (only Gmail confirmed). SPF+DKIM pass
   and Gmail inbox success make it likely, but send one to an Outlook address from `/login`
   and confirm inbox before a real launch push.
2. **DMARC** — `send.solhous.com` has SPF + DKIM but no DMARC record. Optional hardening;
   add `_dmarc.send.solhous.com TXT "v=DMARC1; p=none; rua=mailto:..."` to tighten later.
3. **Deploy the login backstop** — the resend/spam-hint UI in `app/login/page.tsx` is in the
   worktree, not yet on production. Commit + deploy to ship it.

## Code backstops (in `app/login/page.tsx`)

Spam-folder hint, 30s-cooldown Resend button, "use a different address", and human-readable
rate-limit copy. These don't replace real SMTP — they keep a slow/greylisted delivery from
reading as total failure.
