"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  addCatch,
  listCatches,
  pendingEnrichment,
  updateCatch,
  type LocalCatch,
} from "@/lib/store";

/** Connection state as an external store — no setState-in-effect. */
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const getOnline = () => navigator.onLine;
const getOnlineServer = () => true;

/**
 * The capture surface.
 *
 * DESIGN-PRINCIPLES §7.3 — capture costs ZERO decisions. One field, one
 * button. No title, no folder, no tag, no project picker.
 * CLAUDE.md → capture is sacred — the save is local and completes before
 * any network call is even attempted.
 */
export default function Capture() {
  const [value, setValue] = useState("");
  const [catches, setCatches] = useState<LocalCatch[]>([]);
  const [stamp, setStamp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // In-flight guard: addCatch is async, so a fast second click would otherwise
  // read the pre-clear value and mint a duplicate catch. A ref, not state —
  // it must be set synchronously within the same click handler.
  const submittingRef = useRef(false);
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);

  const refresh = useCallback(async () => {
    setCatches(await listCatches());
  }, []);

  // ---- enrichment sweep: runs on load, on reconnect, and on an interval ----
  const sweep = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const pending = await pendingEnrichment();
    for (const c of pending) {
      if (!c.sourceUrl) continue;
      await updateCatch(c.id, { status: "sieving" });
      await refresh();
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: c.sourceUrl }),
        });
        const data = await res.json();
        if (data.ok) {
          await updateCatch(c.id, {
            status: "sieved",
            sourceMeta: {
              title: data.title,
              siteName: data.siteName,
              description: data.description,
            },
            enrichAttempts: c.enrichAttempts + 1,
          });
        } else {
          const attempts = c.enrichAttempts + 1;
          // "couldn't extract, saved anyway" — never a lost catch
          await updateCatch(c.id, {
            status: attempts >= 5 ? "failed_extract" : "raw",
            sourceMeta: { ...c.sourceMeta, siteName: data.siteName, extractError: data.error },
            enrichAttempts: attempts,
          });
        }
      } catch {
        // network died mid-enrichment. Back to 'raw'; the sweep retries later.
        await updateCatch(c.id, {
          status: "raw",
          enrichAttempts: c.enrichAttempts + 1,
        });
      }
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    // IndexedDB is client-only and has no server snapshot, so hydrating the
    // list on mount is unavoidable. The setState happens in a microtask after
    // the await, not synchronously in the effect body — no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().then(sweep);
    const onReconnect = () => void sweep();
    window.addEventListener("online", onReconnect);
    const iv = setInterval(() => void sweep(), 15_000);
    return () => {
      window.removeEventListener("online", onReconnect);
      clearInterval(iv);
    };
  }, [refresh, sweep]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw || submittingRef.current) return;
    submittingRef.current = true;

    try {
      // THE SACRED WRITE — local, first, before anything touches the network.
      await addCatch(raw);
      setValue("");
      inputRef.current?.focus();
      await refresh();

      setStamp(true);
      window.setTimeout(() => setStamp(false), 1400);

      // enrichment is fire-and-forget, deliberately unawaited
      void sweep();
    } finally {
      submittingRef.current = false;
    }
  }

  const isFirst = catches.length === 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl leading-tight text-ink">
          What are you trying to figure out?
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          paste a link, or just start typing. no titles, no folders.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mb-8">
        <textarea
          ref={inputRef}
          data-testid="capture-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void onSubmit(e);
          }}
          rows={3}
          placeholder="…"
          aria-label="Capture"
          className="w-full resize-none border-[3px] border-ink bg-ground p-4 font-serif text-lg text-ink shadow-hard outline-none placeholder:text-ink/30 focus:shadow-hard-lg"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <button
            type="submit"
            data-testid="capture-submit"
            disabled={!value.trim()}
            className="border-[3px] border-ink bg-accent px-6 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink shadow-hard transition-transform disabled:opacity-40 enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none"
          >
            Catch it
          </button>
          <span
            data-testid="connection-state"
            data-online={online}
            className="font-mono text-[11px] uppercase tracking-wider text-ink/50"
          >
            {online ? "online" : "offline — captures still land"}
          </span>
        </div>
      </form>

      {stamp && (
        <div
          data-testid="stamp"
          role="status"
          className="stamp mb-6 inline-block border-[3px] border-ink bg-accent px-4 py-2 font-mono text-sm font-bold uppercase tracking-widest text-ink shadow-hard"
        >
          {isFirst ? "First catch logged" : "Catch logged"}
        </div>
      )}

      <section aria-label="Your catches">
        {catches.length === 0 ? (
          // §7.2 — never a blank page. Pre-seeded with instruction.
          <div
            data-testid="empty-state"
            className="border-[3px] border-dashed border-ink/40 p-6"
          >
            <p className="font-serif text-lg text-ink/70">
              Nothing caught yet. That&rsquo;s the normal starting position.
            </p>
            <p className="mt-2 font-mono text-xs uppercase tracking-wide text-ink/50">
              try: paste the last interesting link you left open in a tab.
            </p>
          </div>
        ) : (
          <ul data-testid="catch-list" className="space-y-4">
            {catches.map((c) => (
              <li
                key={c.id}
                data-testid="catch-item"
                data-status={c.status}
                data-type={c.type}
                className="border-[3px] border-ink bg-ground p-4 shadow-hard"
              >
                {/* serif = the human's material */}
                <p className="font-serif text-lg leading-snug text-ink break-words">
                  {c.type === "link" && c.sourceMeta.title
                    ? c.sourceMeta.title
                    : c.rawContent}
                </p>

                {/* mono = the machine talking */}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink/55">
                  <time dateTime={c.capturedAt}>
                    {new Date(c.capturedAt).toLocaleString()}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{c.type}</span>
                  {c.type === "link" && (
                    <>
                      <span aria-hidden>·</span>
                      <span data-testid="citation">
                        {c.status === "sieved" && c.sourceMeta.title ? (
                          <>cited — {c.sourceMeta.siteName}</>
                        ) : c.status === "sieving" ? (
                          <span data-testid="still-sieving">still sieving…</span>
                        ) : c.status === "failed_extract" ? (
                          <>couldn&rsquo;t extract — saved anyway</>
                        ) : (
                          <span data-testid="still-sieving">still sieving…</span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {c.sourceUrl && (
                  <p className="mt-1 font-mono text-[11px] text-ink/40 break-all">
                    {c.sourceUrl}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
