"use client";

import { useLiveStream } from "@/components/LiveStreamProvider";
import type { LiveEvent } from "@/lib/events";

type Status = "connecting" | "open" | "reconnecting" | "closed";

export type UseLiveEventsReturn = {
  status: Status;
  events: LiveEvent[];
  subscribe: <K extends LiveEvent["channel"]>(
    channel: K,
    handler: (e: Extract<LiveEvent, { channel: K }>) => void,
  ) => () => void;
};

/**
 * Back-compat shim. Delegates to the shared LiveStreamProvider so the Topbar,
 * SMS page, and Voice page all share one underlying WebSocket.
 */
export function useLiveEvents(): UseLiveEventsReturn {
  const { status, events, subscribe } = useLiveStream();
  return { status, events, subscribe };
}
