#!/usr/bin/env node
/**
 * Post a signed sample QoS report at the console (ISIM-718).
 *
 * This is the reference implementation of the request the capture agent makes:
 * if this script works against a deployment, the agent's delivery contract is
 * satisfied. It is also how you populate the /qos screen for a demo without
 * placing a real call.
 *
 *   QOS_WEBHOOK_SECRET=… node scripts/send-sample-qos.mjs [baseUrl] [scenario]
 *
 * scenario: healthy | late-greeting | one-way   (default: healthy)
 */

import { createHmac, randomUUID } from "node:crypto";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const scenario = process.argv[3] ?? "healthy";
const secret = process.env.QOS_WEBHOOK_SECRET;

if (!secret) {
  console.error("QOS_WEBHOOK_SECRET is not set — the endpoint fails closed without it.");
  process.exit(1);
}

const NUMBERS = ["+14152354546", "+14152007407"];

function stream(side, { firstAudioMs, median, gaps = 0, longestGap = 0, clipping = 0, active = 0.42 }) {
  return {
    side,
    firstAudioMs,
    activeRatio: active,
    levelDbfs: { p05: -78.4, p50: median, p95: median + 9.2 },
    clippingRatio: clipping,
    gapCount: gaps,
    longestGapMs: longestGap,
    framesAnalyzed: 2140,
  };
}

const SCENARIOS = {
  healthy: {
    verdict: "healthy",
    audio: [
      stream("caller", { firstAudioMs: 180, median: -26.1 }),
      stream("callee", { firstAudioMs: 240, median: -24.7 }),
    ],
    oneWayAudio: null,
    findings: [],
  },
  "late-greeting": {
    verdict: "degraded",
    audio: [
      stream("caller", { firstAudioMs: 210, median: -25.8 }),
      stream("callee", { firstAudioMs: 940, median: -27.3, gaps: 1, longestGap: 700 }),
    ],
    oneWayAudio: null,
    findings: [
      {
        code: "late_first_audio",
        severity: "warn",
        message:
          "Call answered, but the first 700 ms after bridge carried no audible audio from the callee side. Later speech arrived normally. Inspect media-start timing.",
      },
    ],
  },
  "one-way": {
    verdict: "failing",
    audio: [
      stream("caller", { firstAudioMs: 195, median: -25.2 }),
      stream("callee", {
        firstAudioMs: null,
        median: -89.6,
        active: 0,
      }),
    ],
    oneWayAudio: "caller_to_callee",
    findings: [
      {
        code: "one_way_audio",
        severity: "critical",
        message:
          "Caller audio arrived at the node for the whole call; the callee side never crossed the speech floor. Audio flowed in one direction only.",
      },
    ],
  },
};

const picked = SCENARIOS[scenario];
if (!picked) {
  console.error(`Unknown scenario "${scenario}". Try: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}

const endedAt = new Date();
const startedAt = new Date(endedAt.getTime() - 47_000);
const gated = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];

const report = {
  schemaVersion: "1.0",
  reportId: randomUUID(),
  mode: "passive",
  nodeId: "pbx-use1-a",
  coverage: "telegent-sip-trunk",
  call: {
    linkedId: `${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 900 + 100)}`,
    gatedNumber: gated,
    callerNumber: "+13232030982",
    calleeNumber: gated,
    direction: "inbound",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    answered: true,
    hangupCause: 16,
    hangupCauseText: "Normal Clearing",
    durationMs: 47_000,
    talkTimeMs: 43_200,
  },
  timing: {
    signalingRingingMs: 1_180,
    answerDelayMs: 4_260,
    bridgeDelayMs: 90,
  },
  audio: picked.audio,
  oneWayAudio: picked.oneWayAudio,
  transport: {
    jitterMsMax: 18.4,
    jitterMsMean: 6.1,
    packetsLost: 12,
    fractionLostMax: 0.004,
    rttMsMean: 71.2,
    reportCount: 9,
  },
  verdict: picked.verdict,
  findings: picked.findings,
  measurement: {
    observationPoint: "asterisk_boundary",
    limits: [
      "Audio was measured where it arrived at the SIP node, not at the far-end handset.",
      "No listening-quality score is produced: scoring requires a known reference signal, which a real customer call does not carry.",
      "Time to ringing is trunk signalling and does not prove a handset rang.",
      "No one-way network latency is reported: frame times are node-side wall clock, not synchronised endpoint timestamps.",
    ],
  },
};

const body = JSON.stringify(report);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

const url = `${baseUrl}/api/webhooks/voice/qos-report`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-spenza-timestamp": timestamp,
    "x-spenza-signature": signature,
  },
  body,
});

const text = await res.text();
console.log(`${res.status} ${url}`);
console.log(text);
process.exit(res.ok ? 0 : 1);
