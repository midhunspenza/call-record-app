"use client";

import { useEffect, useState } from "react";
import { useLiveStream } from "@/components/LiveStreamProvider";
import type { LiveEvent } from "@/lib/events";

/**
 * Live list of real calls, assembled from the WebSocket stream.
 *
 * Source events (published by the inbound voice WS in src/server/ws.ts):
 *   voice.stream.handshake (open)   body = { callId, direction, from, to, did }
 *   voice.stream.handshake (closed) body = { closed:true, handshake:{callId} }
 *   voice.transcript.segment        body = { callId, text }  → latest snippet
 *
 * Calls are keyed by callId. A single call has two legs (inbound + outbound
 * audio) that share the callId, so we count open legs and mark the call
 * `streaming` while at least one leg is open. Values can arrive with stray
 * whitespace, so everything is trimmed.
 */

export type LiveCall = {
  callId: string;
  from: string;
  to: string;
  did?: string;
  direction: "in" | "out";
  startedAt: number; // ms epoch of the first handshake
  streaming: boolean;
  snippet?: string; // latest finalized transcript line
};

type Tracked = LiveCall & { openLegs: number };

const MAX_CALLS = 12; // cap the list; replay can carry many past handshakes
const clean = (v: unknown) => (v == null ? "" : String(v).trim());

export function useLiveCalls(): {
  calls: LiveCall[];
  status: ReturnType<typeof useLiveStream>["status"];
} {
  const { subscribe, status } = useLiveStream();
  const [byId, setById] = useState<Map<string, Tracked>>(new Map());

  useEffect(() => {
    const offHandshake = subscribe("voice.stream.handshake", (e: LiveEvent) => {
      const body = e.body as {
        callId?: unknown;
        direction?: unknown;
        from?: unknown;
        to?: unknown;
        did?: unknown;
        closed?: boolean;
        handshake?: { callId?: unknown };
      };

      // Close frame: one leg ended.
      if (body?.closed) {
        const callId = clean(body.handshake?.callId);
        if (!callId) return;
        setById((prev) => {
          const c = prev.get(callId);
          if (!c) return prev;
          const next = new Map(prev);
          const openLegs = Math.max(0, c.openLegs - 1);
          next.set(callId, { ...c, openLegs, streaming: openLegs > 0 });
          return next;
        });
        return;
      }

      // Open frame: new call or another leg of an existing one.
      const callId = clean(body?.callId);
      if (!callId) return;
      const startedAt = Date.parse(e.receivedAt) || Date.now();
      setById((prev) => {
        const next = new Map(prev);
        const existing = next.get(callId);
        if (existing) {
          next.set(callId, { ...existing, openLegs: existing.openLegs + 1, streaming: true });
        } else {
          next.set(callId, {
            callId,
            from: clean(body.from),
            to: clean(body.to),
            did: clean(body.did) || undefined,
            direction: clean(body.direction) === "out" ? "out" : "in",
            startedAt,
            streaming: true,
            openLegs: 1,
          });
        }
        return next;
      });
    });

    const offSegment = subscribe("voice.transcript.segment", (e: LiveEvent) => {
      const body = e.body as { callId?: unknown; text?: unknown };
      const callId = clean(body?.callId);
      const text = clean(body?.text);
      if (!callId || !text) return;
      setById((prev) => {
        const c = prev.get(callId);
        if (!c) return prev;
        const next = new Map(prev);
        next.set(callId, { ...c, snippet: text });
        return next;
      });
    });

    return () => {
      offHandshake();
      offSegment();
    };
  }, [subscribe]);

  const calls = [...byId.values()]
    // Streaming calls first, then most recent.
    .sort((a, b) => Number(b.streaming) - Number(a.streaming) || b.startedAt - a.startedAt)
    .slice(0, MAX_CALLS)
    .map(({ openLegs: _openLegs, ...c }) => c);

  return { calls, status };
}
