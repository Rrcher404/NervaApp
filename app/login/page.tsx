"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Magic-link sign-in. Deliberately spare — value-before-identity (§8) means the
 * user has already captured and sieved before they ever land here. Auth exists
 * only to give the cloud sieve a durable, cross-device home for the vault.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || sending) return;
    setSending(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl leading-tight text-ink">Save your expedition</h1>
      <p className="mt-2 font-sans text-sm text-ink/70">
        A link, a place for it to live, and it&rsquo;s yours across every device. No password.
      </p>

      {sent ? (
        <div
          data-testid="magic-sent"
          className="mt-8 border-[3px] border-ink bg-ground p-5"
        >
          <p className="font-mono text-sm uppercase tracking-wide text-ink">
            Check your email — the link is on its way. Open it in this browser.
          </p>
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
