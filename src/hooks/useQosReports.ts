"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import type { LiveEvent } from "@/lib/events";
import { QosReport, type QosStoreStats, type StoredQosReport } from "@/lib/qos";

/**
 * Seeds from /api/qos, then follows the shared live WebSocket (ISIM-718).
 *
 * Both halves are needed: the socket only carries reports that arrive while the
 * tab is open, so without the seed a freshly opened screen looks like nothing
 * has ever been measured.
 *
 * Live events are validated before display. The bus relays whatever the
 * receiving route published, and a half-typed body rendered as if it were a
 * measurement is worse than dropping it.
 */

export type UseQosReportsReturn = {
  reports: StoredQosReport[];
  stats: QosStoreStats | null;
  loading: boolean;
  error: string | null;
  live: boolean;
};

export function useQosReports(): UseQosReportsReturn {
  const [reports, setReports] = useState<StoredQosReport[]>([]);
  const [stats, setStats] = useState<QosStoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status, subscribe } = useLiveEvents();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/qos?limit=100", { cache: "no-store" });
        if (!res.ok) throw new Error(`History request failed (${res.status})`);
        const data = (await res.json()) as { reports: StoredQosReport[]; stats: QosStoreStats };
        if (cancelled) return;
        setReports(data.reports ?? []);
        setStats(data.stats ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // The parameter is annotated because LiveEvent is a single object type
    // rather than a discriminated union, so the provider's
    // Extract<LiveEvent, { channel: K }> collapses to never. Annotating is
    // sound here (contravariance) and keeps the fix out of shared code.
    return subscribe("voice.qos.report", (event: LiveEvent) => {
      const parsed = QosReport.safeParse(event.body);
      if (!parsed.success) return;
      const incoming: StoredQosReport = { report: parsed.data, receivedAt: event.receivedAt };
      setReports((prev) =>
        prev.some((r) => r.report.reportId === incoming.report.reportId)
          ? prev
          : [incoming, ...prev].slice(0, 100),
      );
      setStats((prev) =>
        prev
          ? { ...prev, count: prev.count + 1, lastReceivedAt: event.receivedAt }
          : prev,
      );
    });
  }, [subscribe]);

  const live = useMemo(() => status === "open", [status]);
  return { reports, stats, loading, error, live };
}
