import { EventEmitter } from "node:events";
import type { LiveEvent } from "@/lib/events";

/**
 * In-memory pub/sub for live events with a bounded replay buffer.
 *
 * Why an in-memory bus: keeps the implementation tight for a single-process
 * deployment. Swap the internals for Redis pub/sub if we ever run >1 instance —
 * the public surface (publish/subscribe/replay) is the seam.
 *
 * The replay buffer lets a WebSocket client that just connected catch up on
 * recent activity instead of starting from a blank screen. 200 events ≈ a few
 * minutes of typical traffic.
 */

const CHANNEL = "evt";
const REPLAY_SIZE = 200;

class EventBus {
  private emitter = new EventEmitter();
  private buffer: LiveEvent[] = [];
  private seenIds = new Set<string>();
  private seenOrder: string[] = [];

  constructor() {
    // Default limit is 10, which trips warnings once a handful of WS clients connect.
    this.emitter.setMaxListeners(0);
  }

  /** Returns true if accepted, false if duplicate. */
  publish(event: LiveEvent): boolean {
    if (this.seenIds.has(event.id)) return false;
    this.seenIds.add(event.id);
    this.seenOrder.push(event.id);
    // Bound the dedupe set too — twice the replay size is plenty.
    while (this.seenOrder.length > REPLAY_SIZE * 2) {
      const evicted = this.seenOrder.shift();
      if (evicted) this.seenIds.delete(evicted);
    }

    this.buffer.push(event);
    if (this.buffer.length > REPLAY_SIZE) this.buffer.shift();

    this.emitter.emit(CHANNEL, event);
    return true;
  }

  subscribe(handler: (event: LiveEvent) => void): () => void {
    this.emitter.on(CHANNEL, handler);
    return () => this.emitter.off(CHANNEL, handler);
  }

  /** Snapshot of the last N events (oldest first). */
  replay(): LiveEvent[] {
    return [...this.buffer];
  }

  stats() {
    return { buffered: this.buffer.length, listeners: this.emitter.listenerCount(CHANNEL) };
  }
}

// Use a module-level singleton, pinned to globalThis so hot reload doesn't reset it.
declare global {
  // eslint-disable-next-line no-var
  var __spenzaEventBus: EventBus | undefined;
}

export const eventBus: EventBus = globalThis.__spenzaEventBus ?? (globalThis.__spenzaEventBus = new EventBus());
