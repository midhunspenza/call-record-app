"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LiveEvent, WsMessage } from "@/lib/events";

/**
 * Single WebSocket to /api/stream shared by every component. Two reasons:
 *
 *  1) The stream multiplexes JSON envelopes AND binary audio frames on the
 *     same socket. Opening a second connection just to pull binary would
 *     double the audio bandwidth.
 *  2) Component-level useLiveEvents() instances would each spawn their own
 *     WS — fine for two listeners, wasteful at 5+ when /voice is open.
 */

type Status = "connecting" | "open" | "reconnecting" | "closed";

type EventHandler<K extends LiveEvent["channel"]> = (e: Extract<LiveEvent, { channel: K }>) => void;
type BinaryHandler = (frame: ArrayBuffer) => void;

type Ctx = {
  status: Status;
  events: LiveEvent[];
  subscribe: <K extends LiveEvent["channel"]>(channel: K, handler: EventHandler<K>) => () => void;
  /** Subscribe to raw binary audio frames (PCM 8 kHz / 16-bit / mono). */
  onBinary: (handler: BinaryHandler) => () => void;
};

const LiveStreamCtx = createContext<Ctx | null>(null);

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;
const EVENT_BUFFER_SIZE = 200;

export function LiveStreamProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const eventHandlers = useRef(new Map<string, Set<(e: LiveEvent) => void>>());
  const binaryHandlers = useRef(new Set<BinaryHandler>());

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus((s) => (s === "open" ? s : "connecting"));
      const url = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/stream`;
      const sock = new WebSocket(url);
      sock.binaryType = "arraybuffer";
      ws = sock;

      sock.addEventListener("open", () => {
        if (cancelled) return;
        backoff = INITIAL_BACKOFF_MS;
        setStatus("open");
      });

      sock.addEventListener("message", (msg) => {
        // Binary frame: audio PCM. Skip JSON parse, hand straight to subscribers.
        if (msg.data instanceof ArrayBuffer) {
          for (const h of binaryHandlers.current) h(msg.data);
          return;
        }
        let parsed: WsMessage;
        try {
          parsed = WsMessage.parse(JSON.parse(typeof msg.data === "string" ? msg.data : ""));
        } catch {
          return;
        }
        if (parsed.kind !== "event") return;
        const ev = parsed.event;
        setEvents((prev) => {
          const next = [...prev, ev];
          return next.length > EVENT_BUFFER_SIZE ? next.slice(next.length - EVENT_BUFFER_SIZE) : next;
        });
        const set = eventHandlers.current.get(ev.channel);
        if (set) for (const h of set) h(ev);
      });

      sock.addEventListener("close", () => {
        if (cancelled) return;
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
      });

      sock.addEventListener("error", () => {
        // close handler runs after error; nothing extra to do.
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, "unmount");
      }
      setStatus("closed");
    };
  }, []);

  const value: Ctx = {
    status,
    events,
    subscribe: (channel, handler) => {
      const map = eventHandlers.current;
      let set = map.get(channel);
      if (!set) {
        set = new Set();
        map.set(channel, set);
      }
      const wrapped = (e: LiveEvent) => {
        if (e.channel === channel) handler(e as Parameters<typeof handler>[0]);
      };
      set.add(wrapped);
      return () => set?.delete(wrapped);
    },
    onBinary: (handler) => {
      binaryHandlers.current.add(handler);
      return () => binaryHandlers.current.delete(handler);
    },
  };

  return <LiveStreamCtx.Provider value={value}>{children}</LiveStreamCtx.Provider>;
}

export function useLiveStream(): Ctx {
  const c = useContext(LiveStreamCtx);
  if (!c) throw new Error("useLiveStream must be used inside <LiveStreamProvider>");
  return c;
}
