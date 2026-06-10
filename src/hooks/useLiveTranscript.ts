"use client";

import { useEffect, useState } from "react";
import { useLiveStream } from "@/components/LiveStreamProvider";
import type { LiveEvent } from "@/lib/events";

/**
 * Live in-call transcript, assembled from the WebSocket stream.
 *
 * The server emits two channels off the inbound voice WS:
 *   voice.transcript.delta    — incremental text, grouped by itemId
 *   voice.transcript.segment  — the finalized utterance for an itemId
 *
 * We key utterances by itemId: deltas append, the segment replaces with the
 * authoritative text and marks it final. Ordering follows first-seen order,
 * which matches speech order since itemIds are issued as turns begin.
 *
 * Pass a `callId` to scope to one call; omit it to show every live call (the
 * monitoring view), which is what the demo call ids in the UI can't match.
 */

export type LiveUtterance = {
  itemId: string;
  text: string;
  at: number;
  final: boolean;
};

export function useLiveTranscript(callId?: string): {
  utterances: LiveUtterance[];
  status: ReturnType<typeof useLiveStream>["status"];
} {
  const { subscribe, status } = useLiveStream();
  const [utterances, setUtterances] = useState<LiveUtterance[]>([]);

  useEffect(() => {
    const matches = (body: { callId?: string }) => !callId || !body.callId || body.callId === callId;

    const offDelta = subscribe("voice.transcript.delta", (e: LiveEvent) => {
      const body = e.body as { callId?: string; itemId?: string; delta?: string };
      if (!body.itemId || !matches(body)) return;
      setUtterances((prev) => {
        const i = prev.findIndex((u) => u.itemId === body.itemId);
        if (i === -1) {
          return [...prev, { itemId: body.itemId!, text: body.delta ?? "", at: Date.now(), final: false }];
        }
        const next = [...prev];
        next[i] = { ...next[i], text: next[i].text + (body.delta ?? "") };
        return next;
      });
    });

    const offSegment = subscribe("voice.transcript.segment", (e: LiveEvent) => {
      const body = e.body as { callId?: string; itemId?: string; text?: string };
      if (!body.itemId || !matches(body)) return;
      setUtterances((prev) => {
        const i = prev.findIndex((u) => u.itemId === body.itemId);
        if (i === -1) {
          return [...prev, { itemId: body.itemId!, text: body.text ?? "", at: Date.now(), final: true }];
        }
        const next = [...prev];
        next[i] = { ...next[i], text: body.text ?? next[i].text, final: true };
        return next;
      });
    });

    return () => {
      offDelta();
      offSegment();
    };
  }, [subscribe, callId]);

  return { utterances, status };
}
