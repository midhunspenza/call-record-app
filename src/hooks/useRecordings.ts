"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveEvents } from "./useLiveEvents";

/**
 * Aggregates voice.call.started, voice.recording.ready, and voice.transcript.ready
 * events into a per-call record describing what's available for playback.
 *
 * Calls are keyed by `audioKey` (the S3 object key, present from recording.ready
 * onward). voice.call.started arrives before the S3 key exists, so until
 * recording.ready lands we provisionally key by callId+direction.
 */

export type Recording = {
  audioKey?: string;             // S3 key — undefined until recording.ready arrives
  callId?: string;
  direction?: "in" | "out";
  from?: string;
  to?: string;
  did?: string;
  /** Presigned URL for the WAV file in S3. Valid until expiresAt. */
  recordingUrl?: string;
  expiresAt?: string;
  durationMs?: number;
  byteCount?: number;
  /** Set once Whisper has finished and the JSON exists in S3. */
  transcriptReady?: boolean;
  /** ISO timestamp when we first heard about the call. */
  firstSeenAt: string;
  /** ISO timestamp of the most recent event for this call. */
  lastEventAt: string;
};

function provisionalKey(callId: string | undefined, direction: string | undefined): string {
  return `${callId ?? "nocall"}::${direction ?? "?"}`;
}

export function useRecordings(): Recording[] {
  const { events } = useLiveEvents();
  const [byKey, setByKey] = useState<Record<string, Recording>>({});

  useEffect(() => {
    if (events.length === 0) return;
    setByKey((prev) => {
      const next = { ...prev };
      for (const ev of events) {
        if (
          ev.channel !== "voice.call.started" &&
          ev.channel !== "voice.recording.ready" &&
          ev.channel !== "voice.transcript.ready"
        ) {
          continue;
        }
        const body = ev.body as
          | { event?: string; data?: Record<string, unknown> }
          | Record<string, unknown>
          | null;

        // voice.transcript.ready is published by our own server with a flat body shape.
        if (ev.channel === "voice.transcript.ready") {
          const tBody = body as {
            audioKey?: string;
            callId?: string;
            direction?: "in" | "out";
          } | null;
          const k = tBody?.audioKey;
          if (!k) continue;
          const existing = next[k] ?? {
            audioKey: k,
            callId: tBody?.callId,
            direction: tBody?.direction,
            firstSeenAt: ev.receivedAt,
            lastEventAt: ev.receivedAt,
          };
          next[k] = { ...existing, transcriptReady: true, lastEventAt: ev.receivedAt };
          continue;
        }

        // The two webhook-delivered events carry { event, data: {...} } shape.
        const data =
          (body && typeof body === "object" && "data" in body
            ? (body as { data?: Record<string, unknown> }).data
            : undefined) ?? {};
        const callId = data.callId as string | undefined;
        const direction = data.direction as "in" | "out" | undefined;
        const from = data.from as string | undefined;
        const to = data.to as string | undefined;
        const did = data.did as string | undefined;

        if (ev.channel === "voice.call.started") {
          const provKey = provisionalKey(callId, direction);
          const existing = next[provKey] ?? {
            firstSeenAt: ev.receivedAt,
            lastEventAt: ev.receivedAt,
          };
          next[provKey] = {
            ...existing,
            callId,
            direction,
            from,
            to,
            did,
            lastEventAt: ev.receivedAt,
          };
          continue;
        }

        // recording.ready: we now have an audioKey. Migrate the provisional row.
        const recordingUrl = data.recordingUrl as string | undefined;
        const audioKey = recordingUrl ? s3KeyFromUrl(recordingUrl) : undefined;
        if (!audioKey) continue;

        const provKey = provisionalKey(callId, direction);
        const prov = next[provKey];
        if (prov) delete next[provKey];

        const existing = next[audioKey] ?? prov ?? {
          firstSeenAt: ev.receivedAt,
          lastEventAt: ev.receivedAt,
        };
        next[audioKey] = {
          ...existing,
          audioKey,
          callId: callId ?? existing.callId,
          direction: direction ?? existing.direction,
          from: from ?? existing.from,
          to: to ?? existing.to,
          did: did ?? existing.did,
          recordingUrl,
          expiresAt: data.expiresAt as string | undefined,
          durationMs: data.durationMs as number | undefined,
          byteCount: data.byteCount as number | undefined,
          lastEventAt: ev.receivedAt,
        };
      }
      return next;
    });
  }, [events]);

  const list = useMemo(
    () =>
      Object.values(byKey)
        // Only show entries that have a downloadable URL — drop pure call.started provisional rows.
        .filter((r) => !!r.recordingUrl)
        .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt)),
    [byKey],
  );

  return list;
}

function s3KeyFromUrl(presignedUrl: string): string | undefined {
  try {
    const u = new URL(presignedUrl);
    const host = u.hostname;
    const pathname = u.pathname.replace(/^\//, "");
    if (host.startsWith("s3.") || host === "s3.amazonaws.com") {
      const idx = pathname.indexOf("/");
      return idx === -1 ? undefined : pathname.slice(idx + 1);
    }
    return pathname || undefined;
  } catch {
    return undefined;
  }
}
