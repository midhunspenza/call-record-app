"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Volume2, VolumeX, Headphones, PhoneOff } from "lucide-react";
import { Call } from "./data";
import { useVoiceAudio } from "@/hooks/useVoiceAudio";
import { cn } from "@/lib/cn";

export function CallHeader({ call }: { call: Call }) {
  const [jitter, setJitter] = useState(12);
  const [latency, setLatency] = useState(84);
  const [mos, setMos] = useState("4.3");
  const audio = useVoiceAudio();
  const listening = audio.state === "playing";

  useEffect(() => {
    const id = setInterval(() => {
      setJitter(Math.round(8 + Math.random() * 10));
      setLatency(Math.round(74 + Math.random() * 26));
      setMos((4.1 + Math.random() * 0.35).toFixed(1));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white border border-spenza-border rounded-card shadow-card py-4 sm:py-[18px] px-4 sm:px-[22px]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mono text-sm sm:text-[17px] font-medium text-spenza-ink min-w-0" style={{ letterSpacing: "-0.01em" }}>
          <span className="truncate">{call.from}</span>
          <ArrowRight strokeWidth={1.75} className="w-4 sm:w-5 h-4 sm:h-5 text-spenza-mute shrink-0" />
          <span className="truncate">{call.to}</span>
          <span className="mono text-[10px] px-2 py-1 bg-[#f4f4f4] border border-spenza-border text-spenza-slate rounded-full">
            via {call.trunk} trunk
          </span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            aria-label={listening ? "Mute" : "Audio is muted"}
            onClick={() => (listening ? audio.mute() : void audio.play())}
            className="w-9 h-9 border border-spenza-border rounded-[10px] flex items-center justify-center text-spenza-ink bg-white hover:bg-[#fafafa] transition-colors duration-150 shrink-0"
            title={listening ? "Mute live audio" : "Unmute live audio"}
          >
            {listening ? (
              <Volume2 strokeWidth={1.75} className="w-[18px] h-[18px]" />
            ) : (
              <VolumeX strokeWidth={1.75} className="w-[18px] h-[18px]" />
            )}
          </button>
          <button
            onClick={() => (listening ? audio.mute() : void audio.play())}
            className={cn("btn btn-sm", listening ? "btn-primary" : "btn-ghost")}
          >
            <Headphones strokeWidth={1.75} className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{listening ? "Listening" : "Join as listener"}</span>
            <span className="sm:hidden">{listening ? "Live" : "Listen"}</span>
          </button>
          {audio.framesPlayed > 0 && (
            <span className="mono text-[11px] text-spenza-mute tnum">
              {audio.framesPlayed} fr · {(audio.bytesPlayed / 1024).toFixed(1)} KB
            </span>
          )}
          <button className="btn btn-sm border border-[#f5c2c2] text-spenza-danger hover:bg-spenza-danger-soft">
            <PhoneOff strokeWidth={1.75} className="w-3.5 h-3.5" />
            End call
          </button>
        </div>
      </div>
      <div className="flex gap-2 mt-3.5 flex-wrap">
        <StatPill label={`CODEC ${call.codec}`} />
        <StatPill label={<>JITTER <span className="tnum">{jitter}</span>ms</>} />
        <StatPill label={<>LATENCY <span className="tnum">{latency}</span>ms</>} />
        <StatPill label={<>MOS <span className="tnum">{mos}</span></>} />
        <StatPill label={`RTP :${call.rtpPort}`} />
        <span className="pill pill-mono pill-orange">
          <span className="dot" />
          STREAMING
        </span>
      </div>
    </div>
  );
}

function StatPill({ label }: { label: React.ReactNode }) {
  return (
    <span className="pill pill-mono">
      <span className="dot" style={{ background: "#16A34A" }} />
      {label}
    </span>
  );
}
