"use client";

import { FileText } from "lucide-react";
import { Recording, fmtBytes, fmtDateTime } from "./data";

export function TranscriptPanel({ recording }: { recording: Recording | null }) {
  if (!recording) {
    return (
      <section className="flex-1 min-h-0 bg-white border border-spenza-border rounded-card shadow-card flex flex-col items-center justify-center text-center py-20 px-5">
        <div className="w-24 h-24 rounded-full bg-spenza-orange-soft text-spenza-orange flex items-center justify-center mb-[22px]">
          <FileText strokeWidth={1.5} className="w-12 h-12" />
        </div>
        <h3 className="text-[22px] font-semibold mb-2 tracking-tight">Pick a recording</h3>
        <p className="text-spenza-slate text-sm max-w-[360px]">
          Select a recording from the left to see its transcript and metadata.
        </p>
      </section>
    );
  }

  return (
    <section className="flex-1 min-h-0 bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden">
      <div className="py-3.5 px-5 border-b border-spenza-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold truncate">Transcript</h4>
          <div className="text-xs text-spenza-mute mt-0.5 mono truncate" style={{ letterSpacing: "-0.01em" }}>
            {recording.name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-spenza-mute">
            <span suppressHydrationWarning>{fmtDateTime(recording.lastModified)}</span>
          </div>
          <div className="text-xs text-spenza-mute mt-0.5 mono">{fmtBytes(recording.size)}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-5">
        <div className="w-16 h-16 rounded-full bg-[#fafafa] text-spenza-mute flex items-center justify-center mb-4 border border-spenza-border">
          <FileText strokeWidth={1.5} className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold mb-1.5 tracking-tight">Transcript not available</h3>
        <p className="text-spenza-slate text-sm max-w-[360px]">
          Transcripts for past recordings aren&apos;t wired up yet. Use the play button on the left to listen to this recording.
        </p>
      </div>
    </section>
  );
}
