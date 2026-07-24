"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  startVoiceCatch,
  flushVoiceAudio,
  finalizeVoiceCatch,
} from "@/lib/store";

/** MediaRecorder support as an external store — no setState-in-effect, SSR-safe. */
const noopSubscribe = () => () => {};
const isSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";
const supportedServer = () => true;

/** How often the growing recording is flushed to disk (ms). */
const FLUSH_EVERY_MS = 3000;

/**
 * Voice capture. One tap to start, one to stop — the worst-day standard.
 *
 * The recording is SACRED, and sacred means durable DURING the recording, not
 * only after Stop. The recorder creates a draft on start, flushes the growing
 * audio to IndexedDB every few seconds, and finalises on stop. A phone dying
 * at 4% mid-ramble — the app's named worst case — leaves a draft on disk that
 * is recovered on next load. Nothing is lost that was ever spoken to it.
 */
export default function VoiceRecorder({
  onCaptured,
  onError,
}: {
  onCaptured: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const supported = useSyncExternalStore(noopSubscribe, isSupported, supportedServer);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | undefined>(undefined);
  const draftIdRef = useRef<string | null>(null);
  const lastFlushRef = useRef(0);
  // Synchronous in-flight guard — a ref, not state, because a double-tap lands
  // during the getUserMedia await, before `recording` state has committed
  // (the exact race Capture's submittingRef already solves for text).
  const startingRef = useRef(false);
  const mimeRef = useRef("audio/webm");
  // Survives unmount-during-getUserMedia: a late-resolving stream is stopped
  // instead of leaking a live mic with no UI to end it.
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    window.clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    startingRef.current = false;
  }, []);

  const currentBlob = useCallback(
    () => new Blob(chunksRef.current, { type: mimeRef.current }),
    [],
  );

  const flush = useCallback(async () => {
    const id = draftIdRef.current;
    if (!id || chunksRef.current.length === 0) return;
    try {
      const buf = await currentBlob().arrayBuffer();
      await flushVoiceAudio(id, buf, mimeRef.current, Date.now() - startedAtRef.current);
    } catch {
      // A failed flush is not fatal — the next flush or the finalise retries,
      // and the draft already on disk holds the last successful flush.
    }
  }, [currentBlob]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Stop the mic on unmount. A draft mid-record stays on disk (recording:
      // true) and is recovered on next load — the ramble is not lost.
      cleanup();
    };
  }, [cleanup]);

  const start = useCallback(async () => {
    if (recording || startingRef.current) return;
    startingRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      onError(
        "Couldn't reach the microphone — nothing was lost. Check the browser's mic permission, or just type it in the box above.",
      );
      return;
    }

    // Unmounted while the permission prompt was open: release and bail, do not
    // touch refs or state on a dead component (the leak Nakamura + Voss found).
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    try {
      streamRef.current = stream;
      chunksRef.current = [];
      mimeRef.current = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";
      const rec = new MediaRecorder(
        stream,
        mimeRef.current ? { mimeType: mimeRef.current } : undefined,
      );
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      lastFlushRef.current = Date.now();
      draftIdRef.current = await startVoiceCatch();

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
        // Periodic durable flush — survives a crash mid-ramble.
        if (Date.now() - lastFlushRef.current >= FLUSH_EVERY_MS) {
          lastFlushRef.current = Date.now();
          void flush();
        }
      };
      rec.onstop = async () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = currentBlob();
        const id = draftIdRef.current;
        draftIdRef.current = null;
        cleanup();
        setRecording(false);
        setElapsed(0);
        if (!id) return;
        try {
          const buf = await blob.arrayBuffer();
          const finalised = await finalizeVoiceCatch(id, buf, mimeRef.current, durationMs);
          if (!finalised) {
            onError("That recording came through empty — nothing was saved. Try again.");
            return;
          }
          await onCaptured();
        } catch {
          onError("Couldn't save that recording — local storage is blocked here.");
        }
      };

      // 1s timeslice → ondataavailable fires every second, feeding the flush.
      rec.start(1000);
      setRecording(true);
      setElapsed(0);
      startingRef.current = false;
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch {
      // MediaRecorder construction or start threw (bad codec, track ended).
      // Release the stream we acquired — otherwise it leaks live.
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      startingRef.current = false;
      onError("Couldn't start recording on this device — try typing it instead.");
    }
  }, [recording, onCaptured, onError, cleanup, flush, currentBlob]);

  const stop = useCallback(() => {
    // Guard the state — a second tap after stop() but before the async 'stop'
    // event would otherwise call stop() on an inactive recorder (InvalidStateError).
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  // Backgrounding / navigating away finalises what we have, rather than losing it.
  useEffect(() => {
    const onHide = () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  if (!supported) return null;

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <button
      type="button"
      data-testid="voice-record"
      data-recording={recording}
      aria-label={recording ? "Stop recording" : "Record a voice memo"}
      onClick={recording ? stop : start}
      className={
        recording
          ? "border-[3px] border-ink bg-accent px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink shadow-hard"
          : "border-[3px] border-ink bg-ground px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide text-ink transition-transform active:translate-x-[3px] active:translate-y-[3px]"
      }
    >
      {recording ? (
        <span data-testid="recording-timer">
          Stop · {mm}:{ss}
        </span>
      ) : (
        "Record"
      )}
    </button>
  );
}
