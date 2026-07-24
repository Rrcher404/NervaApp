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
  recoverVoiceDrafts,
  catchAudioBlob,
  MAX_ENRICH_ATTEMPTS,
  type LocalCatch,
} from "@/lib/store";
import { useSweep } from "@/lib/sieve/useSweep";
import VoiceRecorder from "@/components/VoiceRecorder";
import LessonMoment from "@/components/LessonMoment";

/** Play a voice catch's recording — lets a user verify a misheard transcript. */
function VoicePlayback({ catchItem }: { catchItem: LocalCatch }) {
  const play = useCallback(() => {
    const blob = catchAudioBlob(catchItem);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    void audio.play().catch(() => URL.revokeObjectURL(url));
  }, [catchItem]);
  if (!catchItem.audioData) return null;
  return (
    <button
      type="button"
      data-testid="voice-play"
      onClick={play}
      className="mt-2 border-[3px] border-ink bg-ground px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink transition-transform active:translate-x-[2px] active:translate-y-[2px]"
    >
      ▸ Play recording
    </button>
  );
}

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageDown, setStorageDown] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // In-flight guard: addCatch is async, so a fast second click would otherwise
  // read the pre-clear value and mint a duplicate catch. A ref, not state —
  // it must be set synchronously within the same click handler.
  const submittingRef = useRef(false);
  /** Mirrors `value` so an async failure path can read it without a stale closure. */
  const valueRef = useRef("");
  /** So the stamp timer can be cleared on unmount, like every other timer here. */
  const stampTimerRef = useRef<number | undefined>(undefined);
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);

  const refresh = useCallback(async () => {
    try {
      setCatches(await listCatches());
      setStorageDown(false);
    } catch {
      // The store is unreachable (private mode, blocked upgrade, wedged DB).
      // Say so plainly instead of throwing into the void — but keep the
      // capture box usable, because a user mid-thought needs somewhere to put it.
      setStorageDown(true);
    }
  }, []);

  // Refs must be written outside render, not during it.
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // The sweep (links + voice) lives in a hook so both paths share one mutex
  // and the same hard-won guarantees. See lib/sieve/useSweep.ts.
  const sweep = useSweep(refresh);

  // Shared post-capture: refresh the list, slam the stamp, kick a sweep.
  // Used by both the text submit and the voice recorder.
  const afterCapture = useCallback(async () => {
    await refresh();
    setStamp(true);
    window.clearTimeout(stampTimerRef.current);
    stampTimerRef.current = window.setTimeout(() => setStamp(false), 1400);
    void sweep();
  }, [refresh, sweep]);

  useEffect(() => {
    // IndexedDB is client-only and has no server snapshot, so hydrating the
    // list on mount is unavoidable. The setState happens in a microtask after
    // the await, not synchronously in the effect body — no cascading render.
    // recoverVoiceDrafts() first: adopt any recording that outlived a crash so
    // the ramble gets transcribed instead of sitting as an orphaned draft.
    void recoverVoiceDrafts()
      .catch(() => {})
      .then(refresh)
      .then(sweep);
    const onReconnect = () => void sweep();
    window.addEventListener("online", onReconnect);
    const iv = setInterval(() => void sweep(), 15_000);
    return () => {
      window.removeEventListener("online", onReconnect);
      clearInterval(iv);
      window.clearTimeout(stampTimerRef.current);
    };
  }, [refresh, sweep]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw || submittingRef.current) return;
    submittingRef.current = true;
    setSaveError(null);
    setSaving(true);

    // Clear SYNCHRONOUSLY, in the same tick as the click.
    //
    // Clearing after the await looks safer but races the user: submit, start
    // typing the next thought, and the in-flight setValue("") wipes what they
    // just typed. That is the hyperfocus burst pattern, and losing a
    // half-written thought to it is unforgivable. On failure the text is put
    // back (below), so nothing is destroyed either way.
    setValue("");
    inputRef.current?.focus();

    try {
      // THE SACRED WRITE — local, first, before anything touches the network.
      await addCatch(raw);
      await afterCapture();
    } catch {
      // Storage rejected: quota exceeded, Safari private mode, blocked upgrade.
      // CLAUDE.md — capture is sacred. A failed save must be LOUD and must not
      // destroy the user's text. No auto-dismiss: this state persists until
      // they succeed.
      // Read the CURRENT value without a stale closure, but keep the updater
      // pure — React may call it twice (StrictMode) or discard its result, so
      // calling setSaveError inside it is an API misuse. The ref mirrors value
      // on every render, so it is safe to read here.
      const typedSince = valueRef.current.trim().length > 0;
      if (typedSince) {
        // They have already started something else. Do NOT clobber it — surface
        // the failed text instead so it is still recoverable.
        setSaveError(
          `Couldn't save that one. Nothing was lost — here it is again: ${raw}`,
        );
      } else {
        setValue(raw);
        setSaveError(
          "Couldn't save that one. Your words are still in the box — try again.",
        );
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const isFirst = catches.length === 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl leading-tight text-ink">
          What are you trying to figure out?
        </h1>
        {/* UI copy speaks in the grotesque. Mono is reserved for the machine. */}
        <p className="mt-2 font-sans text-sm text-ink/70">
          Paste a link, or just start typing. No titles, no folders.
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
          className="w-full resize-none border-[3px] border-ink bg-ground p-4 font-serif text-lg text-ink shadow-hard outline-none placeholder:text-ink/70 focus:shadow-hard-lg"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <button
            type="submit"
            data-testid="capture-submit"
            disabled={!value.trim() || saving}
            aria-busy={saving}
            /* Disabled state does NOT use opacity — that dropped the label to
               2.5:1, and this is the default cold-open state every stranger
               sees first. Instead it drops the accent and the hard shadow,
               which per §6 already reads as "not pressable". The design system
               does the work; the label stays at full ink, 15.9:1. */
            className="border-[3px] border-ink px-6 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink transition-transform enabled:bg-accent enabled:shadow-hard disabled:border-ink/60 disabled:bg-ground enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none"
          >
            {saving ? "Catching…" : "Catch it"}
          </button>
          <VoiceRecorder onCaptured={afterCapture} onError={setSaveError} />
          <span
            data-testid="connection-state"
            data-online={online}
            className="ml-auto font-mono text-[11px] uppercase tracking-wider text-ink/70"
          >
            {online ? "online" : "offline — captures still land"}
          </span>
        </div>
      </form>

      {storageDown && !saveError && (
        <div
          data-testid="storage-down"
          role="alert"
          className="mb-6 border-[3px] border-ink bg-ground p-4"
        >
          <p className="font-mono text-sm uppercase tracking-wide text-ink">
            This browser is blocking local storage — captures can&rsquo;t be saved
            here. Private browsing is the usual cause.
          </p>
        </div>
      )}

      {saveError && (
        // Loud, persistent, and NOT a punishment state — it names a machine
        // failure, never a user failure, and the user's words are still in the box.
        <div
          data-testid="save-error"
          role="alert"
          className="mb-6 border-[3px] border-ink bg-ground p-4"
        >
          <p className="font-mono text-sm uppercase tracking-wide text-ink">
            {saveError}
          </p>
        </div>
      )}

      {stamp && (
        <div
          data-testid="stamp"
          role="status"
          className="stamp mb-6 inline-block border-[3px] border-ink bg-accent px-4 py-2 font-mono text-sm font-bold uppercase tracking-widest text-ink shadow-hard"
        >
          {isFirst ? "First catch logged" : "Catch logged"}
        </div>
      )}

      {/* §7 lesson moment — only once a catch exists, so the cold open stays
          frictionless and the lesson lands when there's something to apply it to. */}
      {catches.length > 0 && <LessonMoment />}

      <section aria-label="Your catches">
        {catches.length === 0 ? (
          // §7.2 — never a blank page. Pre-seeded with instruction.
          <div
            data-testid="empty-state"
            className="border-[3px] border-dashed border-ink/60 p-6"
          >
            <p className="font-serif text-lg text-ink/80">
              Nothing caught yet. That&rsquo;s the normal starting position.
            </p>
            <p className="mt-2 font-sans text-sm text-ink/70">
              Try: paste the last interesting link you left open in a tab.
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
                /* No hard shadow: §6 says a bordered+shadowed element is
                   PRESSABLE. A catch card is a record, not a control — giving
                   it the button costume teaches a false affordance. */
                className="border-[3px] border-ink bg-ground p-4"
              >
                {/* serif = the human's material */}
                <p className="font-serif text-lg leading-snug text-ink break-words">
                  {c.type === "link" && c.sourceMeta.title
                    ? c.sourceMeta.title
                    : c.type === "voice" && !c.transcript
                      ? // a voice catch before its transcript lands — never blank
                        "Voice memo"
                      : c.rawContent}
                </p>

                {/* mono = the machine talking */}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink/70">
                  <time dateTime={c.capturedAt}>
                    {new Date(c.capturedAt).toLocaleString()}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{c.type}</span>
                  {c.type === "voice" && (
                    <>
                      {typeof c.durationMs === "number" && (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {Math.floor(c.durationMs / 60000)}:
                            {String(Math.floor((c.durationMs % 60000) / 1000)).padStart(
                              2,
                              "0",
                            )}
                          </span>
                        </>
                      )}
                      <span aria-hidden>·</span>
                      <span data-testid="transcription">
                        {c.status === "sieved" && c.transcript ? (
                          "transcribed"
                        ) : c.status === "failed_extract" ? (
                          <>couldn&rsquo;t transcribe — saved anyway</>
                        ) : (
                          <span data-testid="still-transcribing">
                            {c.status === "sieving"
                              ? "transcribing…"
                              : c.enrichAttempts > 0
                                ? `couldn't reach it — retrying (${c.enrichAttempts}/${MAX_ENRICH_ATTEMPTS})`
                                : "queued for transcription"}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {c.type === "link" && (
                    <>
                      <span aria-hidden>·</span>
                      <span data-testid="citation">
                        {c.status === "sieved" && c.sourceMeta.title ? (
                          <>cited — {c.sourceMeta.siteName}</>
                        ) : c.status === "failed_extract" ? (
                          <>couldn&rsquo;t extract — saved anyway</>
                        ) : (
                          // Honest about which state we are actually in. A
                          // retrying catch must not look identical to a fresh
                          // one for 75 seconds.
                          <span data-testid="still-sieving">
                            {c.status === "sieving"
                              ? "still sieving…"
                              : c.enrichAttempts > 0
                                ? `couldn't reach it — retrying (${c.enrichAttempts}/${MAX_ENRICH_ATTEMPTS})`
                                : "queued for sieving"}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {c.sourceUrl && (
                  <p className="mt-1 font-mono text-[11px] text-ink/70 break-all">
                    {c.sourceUrl}
                  </p>
                )}

                {c.type === "voice" && <VoicePlayback catchItem={c} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
