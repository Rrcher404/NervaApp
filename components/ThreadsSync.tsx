"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { syncCatches, runSieve } from "@/lib/sync";

/**
 * On the threads view: push any local-first catches to the cloud, run the sieve
 * (embed + thread), and refresh so the newly-formed threads appear. Capture
 * happened anonymously and locally; this is where it becomes a durable vault.
 */
export default function ThreadsSync({ userId }: { userId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sieving" | "done" | "error">("idle");
  const ran = useRef(false);

  const run = useCallback(async () => {
    setState("sieving");
    try {
      const { pushed } = await syncCatches(supabaseBrowser(), userId);
      await runSieve();
      setState("done");
      if (pushed > 0) router.refresh();
    } catch {
      // Do NOT swallow it (the old bug): a pipeline failure was invisible, so a
      // user's new catches silently never appeared. Say so, offer a retry.
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
        className="mb-6 font-mono text-[11px] uppercase tracking-wider text-ink/70"
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
        className="mb-6 flex flex-wrap items-center gap-3 border-[3px] border-ink bg-ground p-4"
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
