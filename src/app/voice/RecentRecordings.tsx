"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Phone } from "lucide-react";
import { useRecordings, Recording } from "@/hooks/useRecordings";
import { useTranscript } from "@/hooks/useTranscript";
import { formatPhone } from "@/lib/phone";
import { fmtDur } from "./data";
import { cn } from "@/lib/cn";

/**
 * "Recent" tab on the Voice page.
 *
 * Left:  list of recorded calls aggregated from voice.call.started /
 *        voice.recording.ready / voice.transcript.ready events on /api/stream.
 * Right: <audio> player playing the presigned S3 URL + transcript with the
 *        current word highlighted as audio.currentTime advances.
 */
export function RecentRecordings() {
  const recordings = useRecordings();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Auto-select the newest recording if nothing is picked yet.
  useEffect(() => {
    if (selectedKey || recordings.length === 0) return;
    setSelectedKey(recordings[0].audioKey ?? null);
  }, [recordings, selectedKey]);

  const selected = recordings.find((r) => r.audioKey === selectedKey) ?? null;

  return (
    <div className="voice-layout flex flex-col lg:grid lg:gap-5 lg:[grid-template-columns:360px_1fr] lg:[height:calc(100vh-64px-24px-32px-60px)] lg:min-h-[720px] gap-4">
      <RecordingsList
        recordings={recordings}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      <section className="flex flex-col gap-4 min-w-0">
        {selected ? (
          <RecordingDetail recording={selected} />
        ) : (
          <EmptyState count={recordings.length} />
        )}
      </section>
    </div>
  );
}

function RecordingsList({
  recordings,
  selectedKey,
  onSelect,
}: {
  recordings: Recording[];
  selectedKey: string | null;
  onSelect: (k: string) => void;
}) {
  return (
    <aside className="bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden lg:h-auto">
      <div className="p-3 sm:p-3.5 sm:px-4 sm:pb-2.5 border-b border-spenza-border bg-white sticky top-0 z-[2]">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Recordings</h4>
          <span className="mono text-[11px] text-spenza-mute tnum">{recordings.length}</span>
        </div>
        <div className="text-xs text-spenza-mute mt-1">Finished calls, newest first</div>
      </div>

      <div className="flex-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-2 scroll">
        <div className="flex lg:flex-col gap-2 lg:gap-0">
          {recordings.length === 0 && (
            <div className="text-sm text-spenza-mute px-3 py-6 text-center w-full">
              No recordings yet. Make a call to see it here.
            </div>
          )}
          {recordings.map((r) => {
            const selected = r.audioKey === selectedKey;
            return (
              <div
                key={r.audioKey}
                onClick={() => r.audioKey && onSelect(r.audioKey)}
                className={cn(
                  "relative grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 px-3 py-3 pl-3.5 rounded-xl border cursor-pointer transition-[background,border-color] duration-[120ms] shrink-0 w-[260px] lg:w-auto",
                  selected
                    ? "bg-spenza-orange-soft border-[#fde0cd]"
                    : "border-transparent hover:bg-[#fafafa]",
                )}
              >
                {selected && (
                  <span className="absolute -left-px top-2 bottom-2 w-[3px] bg-spenza-orange rounded-r-[3px]" />
                )}
                <div
                  className="mono text-[13px] font-medium text-spenza-ink flex items-center gap-1.5 min-w-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {r.direction === "in" ? (
                    <ArrowDownLeft strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-success shrink-0" />
                  ) : (
                    <ArrowUpRight strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-orange shrink-0" />
                  )}
                  <span className="truncate">{formatPhone(r.from)}</span>
                </div>
                <div className="mono text-[13px] font-medium text-spenza-ink tnum">
                  {r.durationMs != null ? fmtDur(r.durationMs) : "—"}
                </div>
                <div className="col-start-1 mono text-[11px] text-spenza-mute truncate">
                  → {formatPhone(r.to ?? r.did)}
                </div>
                <div className="col-span-2 text-xs text-spenza-mute mt-0.5 flex items-center gap-2">
                  <span className="mono">{new Date(r.lastEventAt).toLocaleTimeString()}</span>
                  {r.transcriptReady ? (
                    <span
                      className="pill mono text-[10px]"
                      style={{ background: "#ECFDF5", borderColor: "#A7F3D0", color: "#047857" }}
                    >
                      transcript ready
                    </span>
                  ) : (
                    <span className="pill mono text-[10px]">transcribing…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

type TranscriptMode = "whisper" | "live";

function RecordingDetail({ recording }: { recording: Recording }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [mode, setMode] = useState<TranscriptMode>("whisper");

  // Both sources are fetched up front (the callId fetch only fires when the
  // recording has a callId); the toggle just switches which one is displayed.
  const whisper = useTranscript({ audioKey: recording.audioKey });
  const live = useTranscript(recording.callId ? { callId: recording.callId } : undefined);

  const active = mode === "live" ? live : whisper;
  const { status: transcriptStatus, transcript, error: transcriptError } = active;

  // If the saved live transcript is the only one that resolved, surface it.
  useEffect(() => {
    if (whisper.status === "error" && live.status === "ready") setMode("live");
  }, [whisper.status, live.status]);

  useEffect(() => {
    setCurrentTime(0);
    setMode("whisper");
  }, [recording.audioKey]);

  return (
    <>
      <div className="bg-white border border-spenza-border rounded-card shadow-card py-4 sm:py-[18px] px-4 sm:px-[22px]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          <div
            className="mono text-sm sm:text-[17px] font-medium text-spenza-ink min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1"
            style={{ letterSpacing: "-0.01em" }}
          >
            <span className="truncate">{formatPhone(recording.from)}</span>
            <span className="text-spenza-mute">→</span>
            <span className="truncate">{formatPhone(recording.to ?? recording.did)}</span>
            <span
              className="pill mono text-[10px]"
              style={{
                background: "#fff4ed",
                borderColor: "#fde0cd",
                color: "#EA580C",
              }}
            >
              {recording.direction === "in" ? "Inbound" : "Outbound"}
            </span>
          </div>
          {recording.recordingUrl && (
            <a
              href={recording.recordingUrl}
              download
              className="btn btn-sm btn-ghost"
              title="Download original WAV"
            >
              <Download strokeWidth={1.75} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3.5 mono text-[11px] text-spenza-slate">
          {recording.callId && <span className="pill pill-mono">call_id {recording.callId}</span>}
          {recording.durationMs != null && (
            <span className="pill pill-mono">{fmtDur(recording.durationMs)}</span>
          )}
          {recording.byteCount != null && (
            <span className="pill pill-mono">{(recording.byteCount / 1024).toFixed(1)} KB</span>
          )}
          <span className="pill pill-mono">8 kHz · 16-bit · mono</span>
        </div>
      </div>

      <div className="bg-spenza-charcoal border border-spenza-border-dark rounded-card p-3.5 sm:p-4 sm:px-5 shadow-card">
        {recording.recordingUrl ? (
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={recording.recordingUrl}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="w-full"
          />
        ) : (
          <div className="text-sm text-white/60">Recording URL not available.</div>
        )}
        <div className="mt-2 mono text-[11px] text-white/50">
          Recording · 8 kHz · 16-bit PCM · mono
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-spenza-border rounded-card shadow-card overflow-hidden flex flex-col">
        <div className="py-3.5 px-5 border-b border-spenza-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h4 className="text-sm font-semibold shrink-0">Transcript</h4>
            {recording.callId && (
              <div className="inline-flex rounded-lg border border-spenza-border p-0.5 bg-[#fafafa]">
                <button
                  type="button"
                  onClick={() => setMode("whisper")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    mode === "whisper" ? "bg-white text-spenza-ink shadow-sm" : "text-spenza-mute hover:text-spenza-ink",
                  )}
                >
                  Whisper
                </button>
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    mode === "live" ? "bg-white text-spenza-ink shadow-sm" : "text-spenza-mute hover:text-spenza-ink",
                  )}
                >
                  Live
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-spenza-mute shrink-0">
            {transcriptStatus === "ready" && transcript ? (
              mode === "live" ? (
                <span className="mono">{transcript.segments?.length ?? 0} utterances</span>
              ) : (
                <>
                  {transcript.language ?? "auto"} ·{" "}
                  <span className="mono">
                    {transcript.words?.length ?? 0} words
                  </span>
                </>
              )
            ) : transcriptStatus === "pending" ? (
              mode === "live" ? "Loading live transcript…" : "Transcribing with Whisper…"
            ) : transcriptStatus === "error" ? (
              <span className="text-spenza-danger">Error: {transcriptError}</span>
            ) : (
              "Waiting…"
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-[18px] px-5 scroll min-h-[40vh]">
          {transcriptStatus === "ready" && transcript ? (
            mode === "live" ? (
              <LiveTranscriptBody transcript={transcript} />
            ) : (
              <TranscriptBody transcript={transcript} currentTime={currentTime} onSeek={(t) => {
                const a = audioRef.current;
                if (!a) return;
                a.currentTime = t;
                void a.play();
              }} />
            )
          ) : transcriptStatus === "pending" ? (
            <div className="text-sm text-spenza-mute">
              {mode === "live"
                ? "Loading the saved live transcript…"
                : "Transcript is being generated. This usually takes a few seconds after the call ends."}
            </div>
          ) : transcriptStatus === "error" ? (
            <div className="text-sm text-spenza-danger">
              {transcriptError ?? "Failed to fetch transcript."}
            </div>
          ) : (
            <div className="text-sm text-spenza-mute">No transcript yet.</div>
          )}
        </div>
      </div>
    </>
  );
}

function TranscriptBody({
  transcript,
  currentTime,
  onSeek,
}: {
  transcript: NonNullable<ReturnType<typeof useTranscript>["transcript"]>;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const words = transcript.words ?? [];
  const activeWordIdx = useMemo(() => {
    if (words.length === 0) return -1;
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime < words[i].end) return i;
    }
    if (currentTime >= words[words.length - 1].end) return words.length - 1;
    return -1;
  }, [words, currentTime]);

  // Auto-scroll the active word into view.
  const activeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeWordIdx]);

  if (words.length === 0) {
    return (
      <div className="text-[15px] leading-relaxed text-spenza-ink whitespace-pre-wrap">
        {transcript.text}
      </div>
    );
  }

  return (
    <div className="text-[15px] leading-relaxed text-spenza-ink">
      {words.map((w, i) => {
        const isActive = i === activeWordIdx;
        return (
          <span
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSeek(w.start)}
            className={cn(
              "cursor-pointer rounded px-0.5 transition-colors duration-100",
              isActive
                ? "bg-spenza-orange/20 text-spenza-orange"
                : "hover:bg-[#fafafa]",
            )}
            title={`${w.start.toFixed(2)}s`}
          >
            {w.word}{" "}
          </span>
        );
      })}
    </div>
  );
}

function LiveTranscriptBody({
  transcript,
}: {
  transcript: NonNullable<ReturnType<typeof useTranscript>["transcript"]>;
}) {
  // The saved live transcript has finalized utterances (no word-level timings),
  // so render each as its own line. Fall back to the joined text if absent.
  const segments = transcript.segments ?? [];

  if (segments.length === 0) {
    return (
      <div className="text-[15px] leading-relaxed text-spenza-ink whitespace-pre-wrap">
        {transcript.text || "No live transcript was captured for this call."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {segments.map((s, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-spenza-ink">
          {s.text}
        </p>
      ))}
    </div>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-5 bg-white border border-spenza-border rounded-card shadow-card">
      <div className="w-24 h-24 rounded-full bg-spenza-orange-soft text-spenza-orange flex items-center justify-center mb-[22px]">
        <Phone strokeWidth={1.5} className="w-12 h-12" />
      </div>
      <h3 className="text-[22px] font-semibold mb-2 tracking-tight">
        {count > 0 ? "Select a recording" : "No recordings yet"}
      </h3>
      <p className="text-spenza-slate text-sm max-w-[360px]">
        {count > 0
          ? "Pick a call from the list to play back the audio and read the transcript."
          : "When a call finishes on the live stream, its WAV is archived to S3 and transcribed with Whisper. Make a call to see the first recording here."}
      </p>
    </div>
  );
}
