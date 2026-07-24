"use client";

import { useEffect, useRef, useState } from "react";
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
  const [state, setState] = useState<"idle" | "sieving" | "done">("idle");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { pushed } = await syncCatches(supabaseBrowser(), userId);
        setState("sieving");
        await runSieve();
        setState("done");
        if (pushed > 0) router.refresh();
      } catch {
        setState("done"); // the vault still shows whatever already threaded
      }
    })();
  }, [userId, router]);

  if (state === "done" || state === "idle") return null;
  return (
    <p
      data-testid="sieving-indicator"
      className="mb-6 font-mono text-[11px] uppercase tracking-wider text-ink/70"
    >
      sieving your catches…
    </p>
  );
}
