"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveDot } from "@/components/LiveDot";
import { useLiveTranscript } from "@/hooks/useLiveTranscript";
import { Call, fmtTime } from "./data";

export function TranscriptCard({ call }: { call: Call }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const [jitter, setJitter] = useState(12);
  const [latency, setLatency] = useState(84);
  const [mos, setMos] = useState("4.3");
  const [loss, setLoss] = useState("0.02");
  const [sentiment] = useState({ neg: 12, neu: 34, pos: 54 });

  // Real live transcript off the WebSocket. Not scoped to call.id: the demo
  // call ids here won't match the callId spenza-backend assigns, so we show
  // every live utterance arriving on the stream.
  const { utterances, status } = useLiveTranscript();

  // jitter the stats
  useEffect(() => {
    const id = setInterval(() => {
      setJitter(Math.round(8 + Math.random() * 10));
      setLatency(Math.round(74 + Math.random() * 26));
      setMos((4.1 + Math.random() * 0.35).toFixed(1));
      setLoss((Math.random() * 0.12).toFixed(2));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // Follow the tail as new transcript text streams in (unless the user scrolled up).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [utterances]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJump(!nearBottom);
  };

  const jumpToLive = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const keywords = useMemo(
    () => call.keywords ?? ["porting", "esim", "billing"],
    [call.keywords],
  );

  return (
    <div className="flex-1 min-h-0 bg-white border border-spenza-border rounded-card shadow-card grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden">
      <div className="flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-spenza-border relative h-[60vh] lg:h-auto">
        <div className="py-3.5 px-5 border-b border-spenza-border flex items-center justify-between">
          <h4 className="text-sm font-semibold">Live Transcript</h4>
          <div className="text-xs text-spenza-mute inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-spenza-success" : "bg-spenza-mute"}`} />
            <span className="mono">{status === "open" ? "stream live" : status}</span> · gpt-4o-mini-transcribe
          </div>
        </div>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto py-[18px] px-5 scroll-smooth scroll relative"
        >
          {utterances.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6">
              <LiveDot size="sm" />
              <p className="text-sm text-spenza-slate mt-3">
                {status === "open" ? "Listening for live audio…" : "Connecting to the live stream…"}
              </p>
              <p className="text-xs text-spenza-mute mt-1.5 max-w-[280px]">
                Transcription appears here in real time as the call streams in.
              </p>
            </div>
          ) : (
            utterances.map((u) => (
              <motion.div
                key={u.itemId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="grid grid-cols-[32px_1fr] gap-3 mb-[18px]"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-spenza-charcoal text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-[3px]">
                    <span
                      className="mono text-[10px] uppercase font-semibold text-spenza-slate"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      Live transcript
                    </span>
                    <span className="mono text-[11px] text-spenza-mute">{fmtTime(u.at)}</span>
                  </div>
                  <div className="text-[15px] leading-relaxed text-spenza-ink">
                    {u.text}
                    {!u.final && (
                      <span className="inline-flex gap-[3px] items-center ml-1.5 align-middle">
                        <span className="w-1 h-1 bg-spenza-orange rounded-full" style={{ animation: "dotBounce 1.2s 0s infinite ease-in-out" }} />
                        <span className="w-1 h-1 bg-spenza-orange rounded-full" style={{ animation: "dotBounce 1.2s 0.18s infinite ease-in-out" }} />
                        <span className="w-1 h-1 bg-spenza-orange rounded-full" style={{ animation: "dotBounce 1.2s 0.36s infinite ease-in-out" }} />
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        <AnimatePresence>
          {showJump && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: -2 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              onClick={jumpToLive}
              className="absolute right-6 bottom-[18px] bg-spenza-ink text-white rounded-full pl-[11px] pr-3.5 py-[7px] text-xs font-medium inline-flex items-center gap-2 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]"
            >
              <LiveDot size="sm" />
              Jump to live
            </motion.button>
          )}
        </AnimatePresence>
        <style jsx>{`
          @keyframes dotBounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      <aside className="p-[18px] overflow-y-auto bg-[#fafafa] scroll">
        <section className="mb-[22px]">
          <h5 className="text-[10px] font-semibold uppercase text-spenza-mute m-0 mb-2.5" style={{ letterSpacing: "0.18em" }}>
            Call info
          </h5>
          <div className="grid grid-cols-1 gap-2">
            <MetaRow k="Call ID" v={call.callId ?? call.id} small />
            <MetaRow k="Started at" v={call.startedAt ?? "—"} />
            <MetaRow k="Direction" v={call.direction === "in" ? "Inbound" : "Outbound"} />
            {call.did && <MetaRow k="DID" v={call.did} small />}
            <MetaRow k="Trunk" v={call.trunk} />
            <MetaRow k="RTP port" v={call.rtpPort} />
          </div>
        </section>

        <section className="mb-[22px]">
          <h5 className="text-[10px] font-semibold uppercase text-spenza-mute m-0 mb-2.5" style={{ letterSpacing: "0.18em" }}>
            Sentiment
          </h5>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-[#ececec] mb-2">
            <span className="bg-spenza-danger transition-[width] duration-[600ms] ease-out" style={{ width: `${sentiment.neg}%` }} />
            <span className="bg-[#d4d4d4] transition-[width] duration-[600ms] ease-out" style={{ width: `${sentiment.neu}%` }} />
            <span className="bg-spenza-success transition-[width] duration-[600ms] ease-out" style={{ width: `${sentiment.pos}%` }} />
          </div>
          <div className="flex justify-between mono text-[11px] text-spenza-slate">
            <span className="text-spenza-danger">{sentiment.neg}%</span>
            <span>{sentiment.neu}%</span>
            <span className="text-spenza-success">{sentiment.pos}%</span>
          </div>
        </section>

        <section className="mb-[22px]">
          <h5 className="text-[10px] font-semibold uppercase text-spenza-mute m-0 mb-2.5" style={{ letterSpacing: "0.18em" }}>
            Keywords
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <span
                key={k}
                className="pill mono text-[11px]"
                style={{ background: "#FFF4ED", borderColor: "#fde0cd", color: "#EA580C" }}
              >
                {k}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h5 className="text-[10px] font-semibold uppercase text-spenza-mute m-0 mb-2.5" style={{ letterSpacing: "0.18em" }}>
            Quality
          </h5>
          <div className="grid grid-cols-1 gap-2">
            <MetaRow k="PACKET LOSS" v={`${loss}%`} />
            <MetaRow k="CONCEALMENT" v="0.4%" />
            <MetaRow k="ENCRYPTION" v="SRTP/AES-128" />
            <MetaRow k="JITTER" v={`${jitter}ms`} />
            <MetaRow k="LATENCY" v={`${latency}ms`} />
            <MetaRow k="MOS" v={mos} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function MetaRow({ k, v, small }: { k: string; v: string; small?: boolean }) {
  return (
    <div className="flex justify-between text-xs mono items-center">
      <span className="text-spenza-mute">{k}</span>
      <span className={`text-spenza-ink text-right ${small ? "text-[11px]" : ""}`}>{v}</span>
    </div>
  );
}
