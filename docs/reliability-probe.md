# The off-platform reliability probe

The last link in the annunciation chain. Everything else that watches The Sieve —
the drain heartbeat, the nightly audit, `ops_alerts` — runs **inside** the same
Supabase project it watches. Pause that project (or let pg_cron stall) and the
watcher and the watched go dark together, silently. This probe closes that gap:
it runs on **GitHub's** infrastructure, outside the project, and hits
`/api/health` from the outside every ~10 minutes. If the app or Supabase is down,
GitHub still runs the probe, the probe fails, and the operator gets paged.

- **Watcher:** [`.github/workflows/health-probe.yml`](../.github/workflows/health-probe.yml)
- **Watched:** [`app/api/health/route.ts`](../app/api/health/route.ts) at
  `https://the-sieve.vercel.app/api/health`
- **Contract:** `200` healthy · `503` unhealthy (liveness **or** efficacy) ·
  `401` secret mismatch. The probe pages on anything that is not `200`.
- **Cost:** $0.

## What "unhealthy" means here

The endpoint returns `503` on either:

- **Liveness** — no fresh healthy drain (30m) or audit (26h), or an open `ops_alert`.
- **Efficacy** — a real backlog of un-embedded catches despite the drain running,
  or a spike of pipeline failures in `events`. This is the load-bearing part: a
  100% Gemini outage reads **green** on the drain heartbeat alone (failures route
  to `events`, not `drain_runs.error`) but **red** here.

## Two things the operator must do

### 1. Add the `AUDIT_SECRET` repo secret

The probe authenticates with the **same** `AUDIT_SECRET` the health endpoint reads
on Vercel. It must be stored as a GitHub Actions secret — never in the repo.

Interactively (the value is hidden and never printed):

```bash
gh secret set AUDIT_SECRET -R Rrcher404/NervaApp
```

Paste the same value that is set as `AUDIT_SECRET` in the Vercel project. If the
two ever drift apart, the probe gets `401` and pages you — which is the correct
failure: a blind watcher is a broken watcher.

Or via the UI: repo → **Settings → Secrets and variables → Actions → New
repository secret** → name `AUDIT_SECRET`.

### 2. Land this workflow on the default branch (`main`)

GitHub **only schedules workflows from the default branch.** On a feature branch
the file does nothing until it is merged to `main`.

## How you get paged

Two paths, and the first one needs no configuration:

- **GitHub email (default, $0).** A failed scheduled run emails the repo owner.
  Confirm it will actually reach you: GitHub → **Settings → Notifications →
  Actions** → enable *"Send notifications for failed workflows only"* (it is on by
  default). §13 puts the operator away on weekdays — verify this lands on your
  phone, not just an inbox you don't check.
- **Phone push (optional).** Set an `ALERT_WEBHOOK_URL` repo secret to a Slack or
  Discord incoming-webhook URL and the probe POSTs the failure to it. Both are
  $0. One payload (`{"text", "content"}`) covers both services.

  ```bash
  gh secret set ALERT_WEBHOOK_URL -R Rrcher404/NervaApp
  ```

## Verifying it works

1. From the **Actions** tab, open **Reliability probe** → **Run workflow**
   (this uses `workflow_dispatch`). A green run confirms the secret and the
   endpoint agree.
2. To prove the alarm arm, temporarily set `AUDIT_SECRET` to a wrong value and
   run again — you should get `401` and a page. Restore the correct value after.
   (A guard with no failing test is decoration — §8.)

## Known limitation — the 60-day sleep

GitHub **disables scheduled workflows after 60 days of no repository activity.**
This is an active build with regular pushes, so in practice the cron stays awake.
If the repo ever goes quiet for ~2 months, re-enable it from the Actions tab (or
push any commit). There is no $0 way to fully immunize a GitHub cron against this;
it is the accepted cost of the free tier. cron-job.org is the fallback if you want
a scheduler with no such dormancy rule.
