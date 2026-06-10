"use client";

import { useEffect, useState } from "react";

/**
 * Whisper word-level segment. Shape matches openai.audio.transcriptions verbose_json.
 */
export type TranscriptWord = {
  word: string;
  start: number;  // seconds from start of audio
  end: number;
};

export type TranscriptSegment = {
  id?: number;
  seek?: number;
  start: number;
  end: number;
  text: string;
};

export type TranscriptDoc = {
  schema?: string;
  /** "live" for the in-call realtime transcript; absent/whisper for the canonical one. */
  source?: "live" | string;
  audioKey?: string;
  callId?: string;
  from?: string;
  to?: string;
  direction?: string;
  language?: string;
  durationSec?: number;
  text: string;
  segments?: TranscriptSegment[];
  words?: TranscriptWord[];
  transcribedAt?: string;
};

type Status = "idle" | "pending" | "ready" | "error";

const POLL_MS = 4_000;
const MAX_POLLS = 30;  // ~2 minutes — Whisper for a 5-min call is fast, but allow slack

export type TranscriptQuery = { audioKey?: string; callId?: string };

/**
 * Fetches a transcript JSON via /api/transcript. Pass `{ audioKey }` for the
 * canonical Whisper transcript, or `{ callId }` for the saved live (in-call)
 * transcript. If the server returns 202 (still being written), polls every few
 * seconds until ready or until MAX_POLLS attempts.
 */
export function useTranscript(query: TranscriptQuery | undefined) {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<TranscriptDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable primitive to drive the effect — avoids re-fetching when the caller
  // passes a fresh object literal with the same values each render.
  const queryString = query?.audioKey
    ? `audioKey=${encodeURIComponent(query.audioKey)}`
    : query?.callId
      ? `callId=${encodeURIComponent(query.callId)}`
      : null;

  useEffect(() => {
    if (!queryString) {
      setStatus("idle");
      setTranscript(null);
      return;
    }
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      attempt += 1;
      try {
        const res = await fetch(`/api/transcript?${queryString}`);
        if (cancelled) return;
        if (res.status === 200) {
          const json = (await res.json()) as { transcript: TranscriptDoc };
          setTranscript(json.transcript);
          setStatus("ready");
          return;
        }
        if (res.status === 202) {
          setStatus("pending");
          if (attempt < MAX_POLLS) {
            timer = setTimeout(fetchOnce, POLL_MS);
          } else {
            setError("Transcription is taking longer than expected.");
            setStatus("error");
          }
          return;
        }
        const errBody = await res.text();
        setError(`HTTP ${res.status}: ${errBody}`);
        setStatus("error");
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setStatus("error");
      }
    };

    setStatus("pending");
    setTranscript(null);
    setError(null);
    void fetchOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [queryString]);

  return { status, transcript, error };
}
