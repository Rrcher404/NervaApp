"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CatchLite {
  id: string;
  title: string;
}
export interface ThreadLite {
  id: string;
  name: string | null;
  provisional: boolean;
  catches: CatchLite[];
}
export interface ProposalLite {
  id: string;
  aName: string;
  bName: string;
  aProvisional: boolean;
  bProvisional: boolean;
  similarity: number;
}

/** A thread name in the two-voice register: provisional machine guess = mono. */
function ThreadName({ name, provisional }: { name: string; provisional: boolean }) {
  return provisional ? (
    <span className="font-mono text-sm uppercase tracking-wide text-ink/80">{name}</span>
  ) : (
    <span className="font-serif text-ink">{name}</span>
  );
}

async function post(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The epistemic-control surface (§5: "you keep the judgment"). The machine
 * filed and named and proposed; here the human overrides — moves a mis-threaded
 * catch, renames a thread, accepts or dismisses a merge. A provisional
 * (machine-guessed) name renders in MONO — the machine speaking; once the human
 * names it, the title becomes the human's material in SERIF.
 */
export default function ThreadsView({
  threads,
  inbox,
  proposals,
}: {
  threads: ThreadLite[];
  inbox: CatchLite[];
  proposals: ProposalLite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // bump to remount selects after a failure
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const otherThreads = (exceptId: string) => threads.filter((t) => t.id !== exceptId);

  // Surface every failure (the class the committee named). An override that
  // silently didn't apply — on the exact worst day the override exists for — is
  // the same swallow the sync path was scolded for. So: on failure, say so,
  // keep a retry, and remount the select so it doesn't show a move that never
  // happened.
  async function act(key: string, fn: () => Promise<boolean>): Promise<boolean> {
    setBusy(key);
    setFailed(null);
    const ok = await fn();
    setBusy(null);
    if (ok) {
      router.refresh();
    } else {
      setFailed(key);
      setNonce((n) => n + 1);
    }
    return ok;
  }

  return (
    <div className="space-y-6">
      {failed && (
        <div
          data-testid="override-error"
          role="alert"
          className="border-[3px] border-ink bg-ground p-4"
        >
          <p className="font-mono text-sm uppercase tracking-wide text-ink">
            That didn&rsquo;t go through — nothing changed. Check your connection and try again.
          </p>
        </div>
      )}

      {proposals.length > 0 && (
        <section
          data-testid="merge-proposals"
          className="border-[3px] border-ink bg-accent/20 p-5"
        >
          <h2 className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-ink">
            The sieve thinks these might be one thread
          </h2>
          <ul className="space-y-3">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2">
                  <ThreadName name={p.aName} provisional={p.aProvisional} />
                  <span className="font-mono text-ink/70">+</span>
                  <ThreadName name={p.bName} provisional={p.bProvisional} />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">
                  {Math.round(p.similarity * 100)}% alike
                </span>
                <button
                  data-testid="merge-accept"
                  disabled={busy === "m" + p.id}
                  onClick={() =>
                    act("m" + p.id, () =>
                      post("/api/merge/resolve", { proposalId: p.id, accept: true }),
                    )
                  }
                  className="border-2 border-ink bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink"
                >
                  Merge them
                </button>
                <button
                  data-testid="merge-dismiss"
                  disabled={busy === "m" + p.id}
                  onClick={() =>
                    act("m" + p.id, () =>
                      post("/api/merge/resolve", { proposalId: p.id, accept: false }),
                    )
                  }
                  className="border-2 border-ink bg-ground px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink"
                >
                  Keep separate
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {threads.map((t) => (
        <section
          key={t.id}
          data-testid="thread"
          className="border-[3px] border-ink bg-ground p-5 shadow-hard"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            {renaming === t.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = nameDraft.trim();
                  if (name) {
                    void act("r" + t.id, () =>
                      post("/api/thread/rename", { threadId: t.id, name }),
                    ).then(() => setRenaming(null));
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="border-2 border-ink bg-ground px-2 py-1 font-serif text-lg text-ink outline-none"
                />
                <button className="font-mono text-[11px] font-bold uppercase text-ink">
                  Save
                </button>
              </form>
            ) : (
              <button
                data-testid="thread-name"
                onClick={() => {
                  setRenaming(t.id);
                  setNameDraft(t.name ?? "");
                }}
                className="text-left"
                title="Rename this thread"
              >
                {/* provisional machine guess = MONO; human's confirmed title = SERIF */}
                {t.provisional ? (
                  <span className="font-mono text-sm uppercase tracking-wide text-ink/80">
                    {t.name ?? "unnamed"}{" "}
                    <span className="text-ink/70">· suggested, tap to name</span>
                  </span>
                ) : (
                  <span className="font-serif text-xl text-ink">{t.name}</span>
                )}
              </button>
            )}
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
              {t.catches.length}
            </span>
          </div>
          <ul className="space-y-2">
            {t.catches.map((c) => (
              <li
                key={c.id}
                data-testid="thread-catch"
                className="group flex items-start justify-between gap-3 border-l-[3px] border-ink/30 pl-3"
              >
                <span className="font-serif text-ink">{c.title}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {otherThreads(t.id).length > 0 && (
                    <select
                      key={`move-${c.id}-${nonce}`}
                      data-testid="move-select"
                      aria-label="Move to another thread"
                      defaultValue=""
                      disabled={busy === "c" + c.id}
                      onChange={(e) => {
                        const to = e.target.value;
                        if (to)
                          void act("c" + c.id, () =>
                            post("/api/catch/move", { catchId: c.id, toThreadId: to }),
                          );
                      }}
                      className="border-2 border-ink/60 bg-ground font-mono text-[10px] uppercase text-ink/70"
                    >
                      <option value="">move…</option>
                      {otherThreads(t.id).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name ?? "unnamed"}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    data-testid="eject-catch"
                    disabled={busy === "c" + c.id}
                    title="Not this thread — move to Unsorted"
                    onClick={() =>
                      act("c" + c.id, () =>
                        post("/api/catch/move", { catchId: c.id, toThreadId: null }),
                      )
                    }
                    className="border-2 border-ink/60 bg-ground px-2 font-mono text-[10px] uppercase tracking-wide text-ink/70"
                  >
                    not here
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {inbox.length > 0 && (
        <section
          data-testid="inbox"
          className="border-[3px] border-dashed border-ink/60 p-5"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl text-ink/80">Unsorted</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
              a home when a second catch agrees
            </span>
          </div>
          <ul className="space-y-2">
            {inbox.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 border-l-[3px] border-ink/20 pl-3"
              >
                <span className="font-serif text-ink/80">{c.title}</span>
                {threads.length > 0 && (
                  <select
                    key={`inbox-${c.id}-${nonce}`}
                    data-testid="inbox-move-select"
                    aria-label="File into a thread"
                    defaultValue=""
                    disabled={busy === "c" + c.id}
                    onChange={(e) => {
                      const to = e.target.value;
                      if (to)
                        void act("c" + c.id, () =>
                          post("/api/catch/move", { catchId: c.id, toThreadId: to }),
                        );
                    }}
                    className="shrink-0 border-2 border-ink/60 bg-ground font-mono text-[10px] uppercase text-ink/70"
                  >
                    <option value="">file into…</option>
                    {threads.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name ?? "unnamed"}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
