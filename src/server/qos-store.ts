import { appendFile, mkdir, open, stat } from "node:fs/promises";
import path from "node:path";
import { QosReport, type QosStoreStats, type StoredQosReport } from "@/lib/qos";

/**
 * Store for received QoS reports (ISIM-718).
 *
 * Two layers, because the deployment forces the question:
 *
 *   - In memory, always. Bounded ring, same idiom as event-bus.ts, pinned to
 *     globalThis so hot reload doesn't wipe it.
 *   - On disk, when QOS_STORE_PATH is set. Append-only JSONL.
 *
 * fly.toml runs a single 512 MB machine with min_machines_running = 1, so a
 * plain in-memory store loses every report on each deploy. That is fine for a
 * demo and useless for "let me look at last Tuesday". Setting QOS_STORE_PATH to
 * a path on a mounted Fly volume makes reports survive deploys; without a
 * volume the file still survives process restarts but not machine recreation.
 *
 * Disk is best-effort throughout: a write failure is logged and ingestion
 * continues in memory. Losing durability is bad; dropping a live report on the
 * floor because the disk is full is worse.
 */

const MAX_REPORTS = 500;

/** Cap how much of the JSONL tail we read back at boot. */
const MAX_REPLAY_BYTES = 2 * 1024 * 1024;

class QosStore {
  private reports: StoredQosReport[] = [];
  private seen = new Set<string>();
  private loaded = false;
  private loading: Promise<void> | null = null;
  private loadError: string | null = null;

  private get storePath(): string | null {
    const p = process.env.QOS_STORE_PATH?.trim();
    return p ? p : null;
  }

  /**
   * Idempotent, concurrency-safe boot load. Every read path awaits this, so a
   * request that lands before the file has been replayed still sees history
   * rather than an empty list.
   */
  async ready(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) this.loading = this.load();
    await this.loading;
  }

  private async load(): Promise<void> {
    const file = this.storePath;
    if (!file) {
      this.loaded = true;
      return;
    }
    try {
      const info = await stat(file).catch(() => null);
      if (!info) {
        this.loaded = true;
        return;
      }
      // Read only the tail. The file grows without bound, and pulling all of it
      // into memory on a 512 MB machine is a slow-motion outage.
      const start = Math.max(0, info.size - MAX_REPLAY_BYTES);
      const handle = await open(file, "r");
      try {
        const buf = Buffer.alloc(info.size - start);
        await handle.read(buf, 0, buf.length, start);
        const text = buf.toString("utf-8");
        // A partial first line is expected whenever we seeked into the middle.
        const lines = text.split("\n").slice(start > 0 ? 1 : 0);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as StoredQosReport;
            const report = QosReport.parse(parsed.report);
            this.push({ report, receivedAt: parsed.receivedAt ?? new Date().toISOString() });
          } catch {
            // One malformed line must not cost us the rest of the history.
          }
        }
      } finally {
        await handle.close();
      }
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
      console.error("[qos-store] replay failed:", this.loadError);
    } finally {
      this.loaded = true;
    }
  }

  /** In-memory insert with dedupe + bounding. Returns false for a duplicate. */
  private push(entry: StoredQosReport): boolean {
    if (this.seen.has(entry.report.reportId)) return false;
    this.seen.add(entry.report.reportId);
    this.reports.push(entry);
    while (this.reports.length > MAX_REPORTS) {
      const evicted = this.reports.shift();
      if (evicted) this.seen.delete(evicted.report.reportId);
    }
    return true;
  }

  /**
   * Accept a report. Returns false when the agent's outbox has retried a
   * report we already hold, which is the normal, expected case after a
   * transient delivery failure — not an error.
   */
  async add(report: QosReport): Promise<boolean> {
    await this.ready();
    const entry: StoredQosReport = { report, receivedAt: new Date().toISOString() };
    if (!this.push(entry)) return false;

    const file = this.storePath;
    if (file) {
      try {
        await mkdir(path.dirname(file), { recursive: true });
        await appendFile(file, `${JSON.stringify(entry)}\n`, "utf-8");
      } catch (err) {
        console.error(
          "[qos-store] persist failed (report kept in memory):",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return true;
  }

  /** Newest first. Optionally filtered to one instrumented number. */
  async list(opts: { limit?: number; number?: string } = {}): Promise<StoredQosReport[]> {
    await this.ready();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), MAX_REPORTS);
    let rows = [...this.reports].reverse();
    if (opts.number) {
      rows = rows.filter((r) => r.report.call.gatedNumber === opts.number);
    }
    return rows.slice(0, limit);
  }

  async get(reportId: string): Promise<StoredQosReport | null> {
    await this.ready();
    return this.reports.find((r) => r.report.reportId === reportId) ?? null;
  }

  async stats(): Promise<QosStoreStats> {
    await this.ready();
    const last = this.reports[this.reports.length - 1];
    return {
      count: this.reports.length,
      persisted: this.storePath !== null,
      storePath: this.storePath,
      lastReceivedAt: last?.receivedAt ?? null,
      loadError: this.loadError,
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __spenzaQosStore: QosStore | undefined;
}

export const qosStore: QosStore =
  globalThis.__spenzaQosStore ?? (globalThis.__spenzaQosStore = new QosStore());
