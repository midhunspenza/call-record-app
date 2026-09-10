import { z } from "zod";

/**
 * Per-call QoS report contract (ISIM-718).
 *
 * Shared with the capture agent running on the SIP node: that service builds
 * this shape and signs it, this app verifies and displays it. The two are
 * deployed separately, so the wire format carries `schemaVersion` and the
 * receiver rejects anything it does not recognise rather than guessing.
 *
 * Every field here is something we can actually measure at the Asterisk
 * boundary. Notably absent, on purpose:
 *
 *   - No listening-quality / MOS score. ITU-T P.863 is an *intrusive* model —
 *     it scores a degraded signal against a known reference. Passive capture of
 *     real customer calls has no reference, so any score would be invented.
 *   - No one-way latency. Frame arrival times are Asterisk-side wall clock,
 *     not synchronised endpoint timestamps.
 */

export const QOS_SCHEMA_VERSION = "1.0" as const;

/** Which side of the call a captured stream came from. */
export const QosStreamSide = z.enum(["caller", "callee"]);
export type QosStreamSide = z.infer<typeof QosStreamSide>;

const QosLevels = z.object({
  p05: z.number(),
  p50: z.number(),
  p95: z.number(),
});

export const QosStream = z.object({
  side: QosStreamSide,
  /**
   * Milliseconds from bridge to the first frame above the speech floor.
   * `null` means the floor was never crossed: that side sent nothing audible.
   */
  firstAudioMs: z.number().nullable(),
  /** Share of analysed frames at or above the speech floor. */
  activeRatio: z.number().min(0).max(1),
  /** dBFS. Silence sits near -90; a healthy voice path around -30 to -18. */
  levelDbfs: QosLevels,
  /** Share of samples at full scale. Above ~0.001 is audible distortion. */
  clippingRatio: z.number().min(0).max(1),
  /**
   * Gaps counted ONLY inside spans where the opposite side was active, so
   * ordinary conversational silence is never reported as a dropout.
   */
  gapCount: z.number().int().min(0),
  longestGapMs: z.number().min(0),
  framesAnalyzed: z.number().int().min(0),
});
export type QosStream = z.infer<typeof QosStream>;

/**
 * RTCP-derived transport counters. Supporting evidence, not the differentiator —
 * provider consoles already expose these.
 */
export const QosTransport = z.object({
  jitterMsMax: z.number().nullable(),
  jitterMsMean: z.number().nullable(),
  packetsLost: z.number().int().nullable(),
  fractionLostMax: z.number().nullable(),
  rttMsMean: z.number().nullable(),
  reportCount: z.number().int().min(0),
});
export type QosTransport = z.infer<typeof QosTransport>;

/** One directional path through the node. Four exist per call. */
export const QosPath = z.enum([
  "caller_to_node",
  "node_to_caller",
  "callee_to_node",
  "node_to_callee",
]);
export type QosPath = z.infer<typeof QosPath>;

/**
 * ITU-T G.107 transmission rating.
 *
 * Parametric, not signal-based: computed from packet loss, jitter and delay
 * rather than by listening to the audio. That is what makes it legitimate
 * without a reference signal — and why it is labelled MOS-CQE everywhere in
 * the UI rather than the bare "MOS" most dashboards print.
 */
export const QosRating = z.object({
  rFactor: z.number(),
  mosCqe: z.number(),
  category: z.enum(["best", "high", "medium", "low", "poor"]),
  delayMs: z.number(),
  method: z.string(),
});
export type QosRating = z.infer<typeof QosRating>;

export const QosPathQuality = z.object({
  path: QosPath,
  packetLossPercent: z.number().nullable(),
  packetsLost: z.number().nullable(),
  jitterMsMax: z.number().nullable(),
  jitterMsMean: z.number().nullable(),
  rttMsMean: z.number().nullable(),
  reportCount: z.number().int().min(0),
  rating: QosRating.nullable(),
});
export type QosPathQuality = z.infer<typeof QosPathQuality>;

export const QosFinding = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warn", "critical"]),
  message: z.string().min(1),
});
export type QosFinding = z.infer<typeof QosFinding>;

export const QosVerdict = z.enum(["healthy", "degraded", "failing", "insufficient_data"]);
export type QosVerdict = z.infer<typeof QosVerdict>;

export const QosReport = z.object({
  schemaVersion: z.literal(QOS_SCHEMA_VERSION),
  /** Stable per-call id. Doubles as the dedupe key for webhook retries. */
  reportId: z.string().min(1),
  mode: z.enum(["passive", "probe"]),
  nodeId: z.string().min(1),
  /**
   * What this measurement covers, e.g. "telegent-sip-trunk". A SIP trunk result
   * is not a US-wide deliverability result, and the UI prints this rather than
   * letting a reader assume otherwise.
   */
  coverage: z.string().min(1),

  call: z.object({
    linkedId: z.string().min(1),
    /** Which of the instrumented numbers put this call in scope. */
    gatedNumber: z.string().min(1),
    callerNumber: z.string(),
    calleeNumber: z.string(),
    direction: z.enum(["inbound", "outbound"]),
    startedAt: z.string(),
    endedAt: z.string(),
    answered: z.boolean(),
    hangupCause: z.number().int().nullable(),
    hangupCauseText: z.string().nullable(),
    durationMs: z.number().int().min(0),
    talkTimeMs: z.number().int().min(0),
  }),

  timing: z.object({
    /**
     * Dial initiation → signalling ringing on the trunk.
     * This is NOT proof that a handset rang.
     */
    signalingRingingMs: z.number().nullable(),
    /** Ringing → answer. */
    answerDelayMs: z.number().nullable(),
    /** Answer → both legs bridged. Media cannot flow before this instant. */
    bridgeDelayMs: z.number().nullable(),
  }),

  audio: z.array(QosStream),
  oneWayAudio: z.enum(["caller_to_callee", "callee_to_caller"]).nullable(),
  transport: QosTransport.nullable(),
  /**
   * Per-direction quality. Defaulted so a report from an agent predating this
   * field still validates rather than being rejected mid-rollout.
   */
  quality: z.array(QosPathQuality).default([]),

  verdict: QosVerdict,
  findings: z.array(QosFinding),

  /** The method, named, and its limits — carried with every single report. */
  measurement: z.object({
    observationPoint: z.literal("asterisk_boundary"),
    limits: z.array(z.string()),
  }),
});
export type QosReport = z.infer<typeof QosReport>;

/**
 * A report as held by the store. Declared here rather than in qos-store.ts so
 * client components can type against it without importing a module that pulls
 * in node:fs.
 */
export type StoredQosReport = {
  report: QosReport;
  receivedAt: string;
};

export type QosStoreStats = {
  count: number;
  persisted: boolean;
  storePath: string | null;
  lastReceivedAt: string | null;
  loadError: string | null;
};

/* ------------------------------------------------------------------ *
 * Display helpers — shared by the page and its child components.
 * ------------------------------------------------------------------ */

export const VERDICT_LABEL: Record<QosVerdict, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  failing: "Failing",
  insufficient_data: "Not enough data",
};

export function sideLabel(side: QosStreamSide): string {
  return side === "caller" ? "Caller → node" : "Callee → node";
}

/** Direction labels written from the listener's point of view. */
export const PATH_LABEL: Record<QosPath, string> = {
  caller_to_node: "Caller → node",
  node_to_caller: "Node → caller",
  callee_to_node: "Callee → node",
  node_to_callee: "Node → callee",
};

/** Which side experienced this path — what the caller heard, or the callee. */
export const PATH_EXPERIENCED_BY: Record<QosPath, string> = {
  caller_to_node: "what we received from the caller",
  node_to_caller: "what the caller received",
  callee_to_node: "what we received from the callee",
  node_to_callee: "what the callee received",
};

export const RATING_LABEL: Record<QosRating["category"], string> = {
  best: "Best",
  high: "High",
  medium: "Medium",
  low: "Low",
  poor: "Poor",
};

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtDbfs(db: number | null | undefined): string {
  if (db === null || db === undefined) return "—";
  return `${db.toFixed(1)} dBFS`;
}

export function fmtPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Median of a list, ignoring nulls. Returns null when nothing is measurable. */
export function median(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
