"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Magic-link sign-in. Deliberately spare — value-before-identity (§8) means the
 * user has already captured and sieved before they ever land here. Auth exists
 * only to give the cloud sieve a durable, cross-device home for the vault.
 *
 * This is THE door: a stranger reaches FIRST CATCH LOGGED with no account, then
 * lands here to save it. If the email never arrives (rate limit or spam) the
 * conversion dies silently. Deliverability is a founder/dashboard task (custom
 * SMTP + verified domain — see supabase/EMAIL-SETUP.md). What this screen owns
 * is the backstop: tell people where to look, and let them try again without
 * hammering the transport.
 */

/** Seconds the user must wait before a resend is allowed. Long enough to keep a
 *  single person from burning through the hourly send budget by mashing the
 *  button; short enough not to feel like punishment. */
const RESEND_COOLDOWN_S = 30;

/** Translate a Supabase auth error into copy a stranger can act on. The default
 *  messages ("email rate limit exceeded", "over_email_send_rate_limit") read as
 *  system failure; here they read as "wait a moment, not your fault." */
function humanError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("rate_limit") || m.includes("too many")) {
    return "The mail line is busy right now. Wait a minute, then send again.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "That address doesn't look right. Check it and try again.";
  }
  return message;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_S);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        return c - 1 <= 0 ? 0 : c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const send = useCallback(
    async (addr: string) => {
      if (!addr || sending) return;
      setSending(true);
      setError(null);
      const sb = supabaseBrowser();
      const { error } = await sb.auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setSending(false);
      if (error) {
        setError(humanError(error.message));
        return;
      }
      setSentTo(addr);
      startCooldown();
    },
    [sending, startCooldown],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await send(email.trim());
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl leading-tight text-ink">Save your expedition</h1>
      <p className="mt-2 font-sans text-sm text-ink/70">
        A link, a place for it to live, and it&rsquo;s yours across every device. No password.
      </p>

      {sentTo ? (
        <div
          data-testid="magic-sent"
          className="mt-8 border-[3px] border-ink bg-ground p-5"
        >
          <p className="font-mono text-sm uppercase tracking-wide text-ink">
            Check your email — the link is on its way to{" "}
            <span className="normal-case">{sentTo}</span>. Open it in this browser.
          </p>
          <p className="mt-3 font-sans text-sm text-ink/70">
            Nothing after a minute? Look in <strong className="text-ink">spam</strong> or{" "}
            <strong className="text-ink">promotions</strong> — the first one sometimes lands there.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="magic-resend"
              disabled={sending || cooldown > 0}
              onClick={() => send(sentTo)}
              className="border-[3px] border-ink px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-ink transition-transform enabled:bg-accent enabled:shadow-hard disabled:border-ink/40 disabled:bg-ground disabled:text-ink/40 enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none"
            >
              {sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the link"}
            </button>
            <button
              type="button"
              data-testid="magic-change-email"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="font-mono text-xs uppercase tracking-wide text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              Use a different address
            </button>
          </div>

          {error && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-ink/70">
              {error}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8">
          <input
            type="email"
            required
            data-testid="magic-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            className="w-full border-[3px] border-ink bg-ground p-4 font-sans text-lg text-ink shadow-hard outline-none placeholder:text-ink/50 focus:shadow-hard-lg"
          />
          <button
            type="submit"
            disabled={!email.trim() || sending}
            className="mt-3 border-[3px] border-ink px-6 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink transition-transform enabled:bg-accent enabled:shadow-hard disabled:border-ink/60 disabled:bg-ground enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none"
          >
            {sending ? "Sending…" : "Send the link"}
          </button>
          {error && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-ink/70">
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
