import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/home/StatCard";
import { ActionCard } from "@/components/home/ActionCard";
import { WaveformBanner } from "@/components/home/WaveformBanner";
import { SmsBubbles } from "@/components/home/SmsBubbles";
import { LiveDot } from "@/components/LiveDot";
import { Phone, TrendingUp, MessageSquare, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <AppShell crumb="Home">
      <section className="max-w-[920px] mb-7 sm:mb-9">
        <div className="eyebrow eyebrow-orange mb-3.5">SPENZA CONSOLE</div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[38px] leading-[1.1] tracking-tight font-semibold mb-3.5">
          Watch every call and message
          <br className="hidden sm:block" />{" "}
          on your network in real time.
        </h1>
        <p className="text-[15px] sm:text-[17px] leading-[1.55] text-spenza-slate max-w-[680px]">
          This console plugs directly into the Spenza voice and SMS infrastructure.
          Stream live call audio with automatic transcription, and monitor every
          SMS sent and received, all from one place.
        </p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7 sm:mb-9">
        <StatCard
          icon={<Phone strokeWidth={1.75} className="w-[18px] h-[18px]" />}
          label="Active calls"
          value={3}
          delta="+1"
          deltaDirection="up"
          deltaCopy="vs avg"
          live
          delay={0.06}
        />
        <StatCard
          icon={<TrendingUp strokeWidth={1.75} className="w-[18px] h-[18px]" />}
          label="Calls today"
          value={148}
          delta="+12%"
          deltaDirection="up"
          deltaCopy="vs yesterday"
          delay={0.12}
        />
        <StatCard
          icon={<MessageSquare strokeWidth={1.75} className="w-[18px] h-[18px]" />}
          label="Messages today"
          value={2431}
          delta="+4.1%"
          deltaDirection="up"
          deltaCopy="vs yesterday"
          delay={0.18}
        />
        <StatCard
          icon={<Clock strokeWidth={1.75} className="w-[18px] h-[18px]" />}
          label="Avg transcription latency"
          value={412}
          suffix="ms"
          delta="-38ms"
          deltaDirection="down"
          deltaCopy="vs last hour"
          delay={0.24}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 sm:mb-7">
        <ActionCard
          href="/voice"
          delay={0.12}
          banner={
            <>
              <WaveformBanner />
              <span className="pill absolute top-3.5 right-3.5 text-white" style={{ background: "rgba(0,0,0,0.45)", borderColor: "rgba(255,255,255,0.12)" }}>
                <LiveDot size="sm" />
                3 active
              </span>
            </>
          }
          title="Live Voice Stream"
          copy="Listen to active calls on the Spenza SIP trunk with real-time transcription, speaker labels, and live waveform."
          chips={["SIP", "RTP", "WSS"]}
          cta="Open live voice"
        />
        <ActionCard
          href="/sms"
          delay={0.18}
          banner={
            <>
              <SmsBubbles />
              <span className="pill absolute top-3.5 right-3.5 text-white" style={{ background: "rgba(0,0,0,0.45)", borderColor: "rgba(255,255,255,0.12)" }}>
                <span className="dot" style={{ background: "#FF4500" }} />
                2,431 today
              </span>
            </>
          }
          title="SMS Traffic"
          copy="Browse every inbound and outbound message across your numbers, with delivery status, threading, and per-number filters."
          chips={["INBOUND", "OUTBOUND", "DLR"]}
          cta="Open SMS"
        />
      </section>

      <div className="mt-7 px-[18px] py-3.5 bg-white border border-spenza-border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 text-[13px]">
        <div className="flex items-center gap-2.5 text-spenza-slate">
          <span className="w-2 h-2 rounded-full bg-spenza-success" />
          Connected to <span className="mono text-spenza-ink">sip.spenza.com</span>
        </div>
        <div className="mono text-xs text-spenza-mute">
          spenza-console v1.4.2 · build a8e3f9c
        </div>
      </div>
    </AppShell>
  );
}
