"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Call, fmtTime } from "./data";
import { useLiveCalls, type LiveCall } from "@/hooks/useLiveCalls";
import { CallsList } from "./CallsList";
import { CallHeader } from "./CallHeader";
import { WaveformCard } from "./WaveformCard";
import { TranscriptCard } from "./TranscriptCard";
import { RecentRecordings } from "./RecentRecordings";
import { cn } from "@/lib/cn";

/**
 * Adapt a real LiveCall onto the Call shape the cards expect. Identity fields
 * (from/to/did/direction/callId/startedAt/streaming) are real; the decorative
 * telemetry fields (trunk/codec/rtpPort/speakers/keywords) keep placeholder
 * defaults so the simulated UI chrome still renders.
 */
function toCall(lc: LiveCall): Call {
  return {
    id: lc.callId,
    callId: lc.callId,
    from: lc.from || "unknown",
    to: lc.to || "unknown",
    did: lc.did,
    direction: lc.direction,
    durationStart: lc.startedAt,
    streaming: lc.streaming,
    startedAt: fmtTime(lc.startedAt),
    snippet: lc.snippet ?? (lc.streaming ? "Live call in progress…" : "Call ended"),
    // ── decorative defaults (not carried on the stream) ──
    trunk: "SpenzaJ",
    codec: "pcm16",
    rtpPort: "—",
    speakers: { agent: "Agent", customer: "Customer" },
  };
}

export default function VoicePage() {
  const { calls: liveCalls } = useLiveCalls();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seg, setSeg] = useState<"active" | "recent">("active");

  const calls = liveCalls.map(toCall);
  const activeCount = liveCalls.filter((c) => c.streaming).length;
  // Keep the user's pick if it's still around; otherwise default to the top call.
  const call = calls.find((c) => c.id === selectedId) ?? calls[0];

  return (
    <AppShell crumb="Live Voice">
      <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-5 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">Live Voice</h1>
            <div className="text-spenza-slate text-sm mt-1">
              Real-time call monitoring on <span className="mono text-spenza-ink">sip.spenza.com</span>
            </div>
          </div>
          <div className="inline-flex bg-white border border-spenza-border rounded-[10px] p-[3px] self-start">
            {(["active", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeg(s)}
                className={cn(
                  "h-[30px] px-3.5 text-[13px] font-medium rounded-[7px] transition-[background,color] duration-150",
                  seg === s
                    ? "bg-spenza-ink text-white"
                    : "text-spenza-slate hover:text-spenza-ink",
                )}
              >
                {s === "active" ? (
                  <>Active <span className="mono opacity-70">({activeCount})</span></>
                ) : (
                  "Recent"
                )}
              </button>
            ))}
          </div>
        </div>

        {seg === "active" ? (
          <div className="voice-layout flex flex-col lg:grid lg:gap-5 lg:[grid-template-columns:360px_1fr] lg:[height:calc(100vh-64px-24px-32px-60px)] lg:min-h-[720px] gap-4">
            <CallsList calls={calls} selectedId={call?.id ?? ""} onSelect={setSelectedId} />

            <section className="flex flex-col gap-4 min-w-0">
              {call ? (
                <>
                  <CallHeader call={call} />
                  <WaveformCard durationStart={call.durationStart} />
                  <TranscriptCard call={call} />
                </>
              ) : (
                <EmptyState />
              )}
            </section>
          </div>
        ) : (
          <RecentRecordings />
        )}
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-5 bg-white border border-spenza-border rounded-card shadow-card">
      <div className="w-24 h-24 rounded-full bg-spenza-orange-soft text-spenza-orange flex items-center justify-center mb-[22px]">
        <Phone strokeWidth={1.5} className="w-12 h-12" />
      </div>
      <h3 className="text-[22px] font-semibold mb-2 tracking-tight">Select an active call</h3>
      <p className="text-spenza-slate text-sm max-w-[360px]">
        Choose a call from the left to listen in and view the live transcript.
      </p>
    </div>
  );
}
