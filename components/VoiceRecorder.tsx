"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { addVoiceCatch } from "@/lib/store";

/** MediaRecorder support as an external store — no setState-in-effect, SSR-safe. */
const noopSubscribe = () => () => {};
const isSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";
const supportedServer = () => true;

/**
 * Voice capture. One tap to start, one tap to stop — the worst-day standard
 * (11:40pm, 4% battery, can't face typing).
 *
 * Capture is sacred: on stop, the recording is written to the local store
 * BEFORE any transcription is attempted. If the mic, the browser, or Whisper
 * is unavailable, the audio is still safe on disk — the sweep transcribes it
 * whenever it can, exactly like a link waits for enrichment.
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

  const cleanup = useCallback(() => {
    window.clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (recording) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or no device. Not a lost capture — nothing was
      // recorded yet — but say so plainly instead of failing silently.
      onError("Couldn't reach the microphone. Check the browser's mic permission.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, {
        type: rec.mimeType || "audio/webm",
      });
      cleanup();
      setRecording(false);
      setElapsed(0);
      if (blob.size === 0) {
        onError("That recording came through empty — nothing was saved. Try again.");
        return;
      }
      try {
        // THE SACRED WRITE for voice — local, before any transcription.
        await addVoiceCatch(blob, durationMs);
        await onCaptured();
      } catch {
        onError("Couldn't save that recording — local storage is blocked here.");
      }
    };

    startedAtRef.current = Date.now();
    rec.start();
    setRecording(true);
    setElapsed(0);
    tickRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
  }, [recording, onCaptured, onError, cleanup]);

  const stop = useCallback(() => {
    recorderRef.current?.stop(); // fires onstop, which does the sacred write
  }, []);

  if (!supported) {
    // Degrade honestly: no mic support means no button, not a broken one.
    return null;
  }

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
