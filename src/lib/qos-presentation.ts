import type { QosPath, QosRating, QosReport, QosStream, QosVerdict } from "./qos";

/**
 * The customer-facing vocabulary for call quality (ISIM-718).
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 * Everything a customer can see on the Call Quality screen passes through
 * this file. Nothing on that screen may reveal:
 *
 *   • the upstream carrier's name        (report.coverage is "telegent-…")
 *   • our infrastructure                 (nodeId, "Asterisk", "SIP node")
 *   • internal identifiers               (linkedId, raw reportId, schemaVersion)
 *   • our internal data model            ("caller"/"callee", path codes)
 *   • engineering diagnostics            (frame counts, RTCP report counts,
 *                                         active ratios, dBFS percentiles)
 *
 * Those fields all still exist on the report — they are needed for support and
 * debugging, and are available through the API and the logs. They are simply
 * not rendered. Keeping the boundary in one module means "can a customer see
 * X?" is answered by reading this file rather than by auditing every component.
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ---------------------------------------------------------------- *
 * Verdict
 * ---------------------------------------------------------------- */

export type Tone = "good" | "warn" | "bad" | "neutral";

export const VERDICT_PRESENTATION: Record<
  QosVerdict,
  { label: string; tone: Tone; summary: string }
> = {
  healthy: {
    label: "Good call quality",
    tone: "good",
    summary: "Audio flowed cleanly in both directions for the whole call.",
  },
  degraded: {
    label: "Quality issues detected",
    tone: "warn",
    summary: "The call connected, but something would have been noticeable to the people on it.",
  },
  failing: {
    label: "Poor call quality",
    tone: "bad",
    summary: "This call had a fault serious enough to affect the conversation.",
  },
  insufficient_data: {
    label: "Not enough to judge",
    tone: "neutral",
    summary: "The call was too short, or was never answered, so quality could not be assessed.",
  },
};

/* ---------------------------------------------------------------- *
 * Parties — never "caller"/"callee", which are our model's words
 * ---------------------------------------------------------------- */

export type Party = "yours" | "other";

/** Which party a captured stream belongs to, given the call's direction. */
export function partyOf(side: QosStream["side"], direction: QosReport["call"]["direction"]): Party {
  const monitored = direction === "inbound" ? "callee" : "caller";
  return side === monitored ? "yours" : "other";
}

export function partyLabel(party: Party): string {
  return party === "yours" ? "Your line" : "Other party";
}

const PATH_PARTS: Record<QosPath, { side: QosStream["side"]; inbound: boolean }> = {
  caller_to_node: { side: "caller", inbound: true },
  node_to_caller: { side: "caller", inbound: false },
  callee_to_node: { side: "callee", inbound: true },
  node_to_callee: { side: "callee", inbound: false },
};

/** A path described as a customer would think about it: who heard what. */
export function pathPresentation(
  path: QosPath,
  direction: QosReport["call"]["direction"],
): { title: string; meaning: string; isYourExperience: boolean } {
  const { side, inbound } = PATH_PARTS[path];
  const party = partyOf(side, direction);
  const who = party === "yours" ? "your line" : "the other party";

  // "inbound" here means arriving at our network from that party.
  if (inbound) {
    return {
      title: `Audio sent by ${who}`,
      meaning: `The quality of what ${who} sent, measured as it reached our network.`,
      isYourExperience: false,
    };
  }
  return {
    title: `Audio delivered to ${who}`,
    meaning:
      party === "yours"
        ? "The quality your line received — this is what you would have heard."
        : "The quality the other party received — this is what they would have heard.",
    isYourExperience: party === "yours",
  };
}

/* ---------------------------------------------------------------- *
 * Quality score
 * ---------------------------------------------------------------- */

export const RATING_PRESENTATION: Record<QosRating["category"], { label: string; tone: Tone }> = {
  best: { label: "Excellent", tone: "good" },
  high: { label: "Good", tone: "good" },
  medium: { label: "Fair", tone: "warn" },
  low: { label: "Poor", tone: "bad" },
  poor: { label: "Very poor", tone: "bad" },
};

/**
 * Score out of 5, which is the scale people expect.
 *
 * The underlying model tops out at 4.5 — it does not believe perfection is
 * achievable on a voice line — so the number is shown as-is rather than
 * rescaled. Rescaling to make 4.4 look like 5.0 would flatter the result and
 * make every comparison with an industry figure wrong.
 */
export function scoreOutOfFive(rating: QosRating): string {
  return rating.mosCqe.toFixed(1);
}

/* ---------------------------------------------------------------- *
 * Measurements, in words rather than units
 * ---------------------------------------------------------------- */

/** Audio level as a judgement, with the measurement kept as supporting detail. */
export function levelBand(medianDbfs: number): { label: string; tone: Tone } {
  if (medianDbfs < -45) return { label: "Too quiet", tone: "warn" };
  if (medianDbfs < -35) return { label: "Quiet", tone: "warn" };
  if (medianDbfs > -8) return { label: "Too loud", tone: "warn" };
  return { label: "Normal", tone: "good" };
}

export function distortionBand(clippingRatio: number): { label: string; tone: Tone } {
  if (clippingRatio > 0.01) return { label: "Heavy", tone: "bad" };
  if (clippingRatio > 0.001) return { label: "Audible", tone: "warn" };
  return { label: "None", tone: "good" };
}

export function lossBand(percent: number | null): { label: string; tone: Tone } {
  if (percent === null) return { label: "Not reported", tone: "neutral" };
  if (percent >= 3) return { label: "Severe", tone: "bad" };
  if (percent >= 1) return { label: "Noticeable", tone: "warn" };
  if (percent > 0) return { label: "Slight", tone: "good" };
  return { label: "None", tone: "good" };
}

/** Hangup causes a customer would recognise. Unknown codes become neutral text. */
const CAUSE_TEXT: Record<number, string> = {
  16: "Ended normally",
  17: "Line was busy",
  18: "No response",
  19: "No answer",
  21: "Call rejected",
  31: "Ended normally",
  34: "Network was busy",
  38: "Network problem",
  41: "Temporary network failure",
  42: "Network congestion",
};

export function endedText(cause: number | null): string {
  if (cause === null) return "Ended";
  return CAUSE_TEXT[cause] ?? "Ended";
}

/* ---------------------------------------------------------------- *
 * Formatting
 * ---------------------------------------------------------------- */

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function seconds(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function percent(ratio: number | null, digits = 2): string {
  if (ratio === null) return "—";
  return `${ratio.toFixed(digits)}%`;
}

/**
 * A short, opaque reference for support conversations.
 *
 * Deliberately a slice of the report id rather than the call's internal
 * identifier: it is enough to find the record, and reveals nothing about how
 * calls are numbered or routed.
 */
export function referenceCode(reportId: string): string {
  return reportId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/* ---------------------------------------------------------------- *
 * What the measurement does and does not establish
 * ---------------------------------------------------------------- */

/**
 * The customer-facing version of the limits carried on every report.
 *
 * Same discipline, none of the plumbing: no mention of the carrier, the codec,
 * or what software sits at the measurement point. Kept because a quality report
 * that survives scrutiny is worth more than a confident one that does not.
 */
export const CUSTOMER_LIMITS: string[] = [
  "Measurements are taken at our network edge, not inside the phone or handset at either end.",
  "The quality score is calculated from packet loss, jitter and delay on the connection — it is not produced by listening to the recording.",
  "Time to ring reflects the signal from the network and does not confirm the moment a handset began ringing.",
  "Audio levels are summarised over the parts of the call where someone was speaking.",
];

export const MEASUREMENT_NOTE =
  "Quality is measured independently at our network edge for every call on this number, in both directions.";

/* ---------------------------------------------------------------- *
 * Customer-facing observations
 * ---------------------------------------------------------------- */

export type CustomerFinding = { text: string; tone: Exclude<Tone, "good" | "neutral"> };

/**
 * Observations written for the person whose call it was.
 *
 * Deliberately derived from the report's structured fields rather than from the
 * agent's `findings[]`. Those messages are written for whoever is debugging the
 * network — they say "bridge", "callee side", "R=33.65", "inspect media-start
 * timing" — and relaying them would leak our data model and infrastructure
 * straight past the boundary this module exists to hold.
 *
 * Same evidence, same thresholds, different reader.
 */
export function customerFindings(report: QosReport): CustomerFinding[] {
  const out: CustomerFinding[] = [];
  const direction = report.call.direction;

  if (!report.call.answered) {
    out.push({
      text: `The call was not answered, so audio quality could not be measured. ${endedText(
        report.call.hangupCause,
      )}.`,
      tone: "warn",
    });
    return out;
  }

  for (const s of report.audio) {
    if (s.framesAnalyzed === 0) continue; // never measured — claim nothing
    const who = partyOf(s.side, direction) === "yours" ? "your line" : "the other party";
    const Who = who.charAt(0).toUpperCase() + who.slice(1);

    if (s.firstAudioMs !== null && s.firstAudioMs > 800) {
      out.push({
        text: `The call connected, but nothing could be heard from ${who} for the first ${seconds(
          s.firstAudioMs,
        )}. Speech was normal after that — the opening words would have been missed.`,
        tone: "warn",
      });
    }

    if (s.gapCount > 0 && s.longestGapMs >= 1200) {
      out.push({
        text: `Audio from ${who} cut out ${s.gapCount === 1 ? "once" : `${s.gapCount} times`} while the other person was speaking. The longest break lasted ${seconds(
          s.longestGapMs,
        )}.`,
        tone: "warn",
      });
    }

    if (s.clippingRatio > 0.001) {
      out.push({
        text: `${Who} came through distorted — the audio was too loud at source and the peaks were flattened.`,
        tone: "warn",
      });
    }

    if (s.activeRatio > 0 && s.levelDbfs.p50 < -45) {
      out.push({
        text: `${Who} was noticeably quiet throughout, which makes the call harder to follow.`,
        tone: "warn",
      });
    }
  }

  for (const q of report.quality) {
    const p = pathPresentation(q.path, direction);
    const who = p.isYourExperience
      ? "your line"
      : p.title.includes("delivered")
        ? "the other party"
        : null;
    if (!who || !q.rating) continue;

    if (q.rating.rFactor < 70) {
      out.push({
        text: `The connection carrying audio to ${who} was ${RATING_PRESENTATION[
          q.rating.category
        ].label.toLowerCase()}${
          q.packetLossPercent !== null ? `, losing ${percent(q.packetLossPercent)} of the audio in transit` : ""
        }. This is what ${who === "your line" ? "you" : "they"} would have heard.`,
        tone: q.rating.rFactor < 60 ? "bad" : "warn",
      });
    } else if (q.packetLossPercent !== null && q.packetLossPercent >= 1) {
      out.push({
        text: `${percent(q.packetLossPercent)} of the audio heading to ${who} did not arrive, which is enough to be noticeable.`,
        tone: "warn",
      });
    }
  }

  if (report.timing.signalingRingingMs !== null && report.timing.signalingRingingMs > 4000) {
    out.push({
      text: `The network took ${seconds(
        report.timing.signalingRingingMs,
      )} to start ringing, which callers may experience as a delay before anything happens.`,
      tone: "warn",
    });
  }

  return out;
}
