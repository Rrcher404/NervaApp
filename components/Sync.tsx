"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { syncCatches, runSieve } from "@/lib/sync";
import { clearSyncedCatches } from "@/lib/store";

/**
 * Local-first → durable vault, on the FIRST authed page load — not just /threads.
 *
 * The ship-check caught this: capture happens anonymously in IndexedDB, but the
 * push-to-server + sieve only ran on /threads, while magic-link login lands on
 * /home. So a converted stranger's catches never reached the server until they
 * manually visited Threads — and /home computed a FALSE re-entry gap from an
 * empty server, inverting item 5's promise. Mounting this in the authed layout
 * makes the sync fire wherever the user lands. Guarded to run once per full load;
 * runSieve is idempotent and cheap when nothing is pending.
 */
export default function Sync({ userId }: { userId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sieving" | "done" | "error">("idle");
  const ran = useRef(false);

  const run = useCallback(async () => {
    setState("sieving");
    try {
      const { pushed } = await syncCatches(supabaseBrowser(), userId);
      // Adopt-and-reclaim: the catches now live durably in the user's Supabase
      // vault, so the local copies no longer need to linger — and lingering is
      // exactly what bleeds a converted stranger's catches into the next
      // anonymous visitor on a shared browser. Only provably-synced rows go;
      // anything still local-only (offline, enriching, recording) is preserved.
      await clearSyncedCatches();
      await runSieve();
      setState("done");
      // only disturb the page if we actually moved local catches up — otherwise
      // this is a silent no-op on a normal navigation.
      if (pushed > 0) router.refresh();
    } catch {
      // Never swallow it: a pipeline failure used to make new catches silently
      // never appear. Say so, offer a retry, keep the catches safe.
      setState("error");
    }
  }, [userId, router]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
  }, [run]);

  if (state === "sieving") {
    return (
      <p
        data-testid="sieving-indicator"
        className="mx-auto w-full max-w-2xl px-6 pt-4 font-mono text-[11px] uppercase tracking-wider text-ink/70"
      >
        sieving your catches…
      </p>
    );
  }
  if (state === "error") {
    return (
      <div
        data-testid="sieve-error"
        role="alert"
        className="mx-auto mt-4 flex w-full max-w-2xl flex-wrap items-center gap-3 border-[3px] border-ink bg-ground px-6 py-4"
      >
        <p className="font-mono text-sm uppercase tracking-wide text-ink">
          Couldn&rsquo;t reach the sieve — your catches are safe, they just aren&rsquo;t sorted yet.
        </p>
        <button
          onClick={() => void run()}
          className="border-2 border-ink bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink"
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}
