"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RecordingsList } from "./RecordingsList";
import { TranscriptPanel } from "./TranscriptPanel";
import type { Recording } from "./data";

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/recordings")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Request failed: ${res.status}`);
        }
        return res.json() as Promise<{ items: Recording[] }>;
      })
      .then(({ items }) => {
        if (cancelled) return;
        setRecordings(items);
        setSelectedKey((prev) => prev ?? items[0]?.key ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = recordings.find((r) => r.key === selectedKey) ?? null;

  return (
    <AppShell crumb="Recordings">
      <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-5 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">Recordings</h1>
            <div className="text-spenza-slate text-sm mt-1">
              Past call recordings stored on{" "}
              <span className="mono text-spenza-ink">s3</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:gap-5 lg:[grid-template-columns:360px_1fr] lg:[height:calc(100vh-64px-24px-32px-60px)] lg:min-h-[720px] gap-4">
          <RecordingsList
            recordings={recordings}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            loading={loading}
            error={error}
          />
          <TranscriptPanel recording={selected} />
        </div>
      </div>
    </AppShell>
  );
}
