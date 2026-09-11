/**
 * Illustrative data for the Voice Agent Quality preview.
 *
 * NOTHING HERE IS MEASURED. This page is a design preview of a capability that
 * does not yet exist: no backend produces these figures, no call was analysed
 * to create them. They are written to be plausible so the layout can be judged
 * on realistic content.
 *
 * The page states this prominently. A console that mixes real measurements with
 * invented ones, unlabelled, is worse than one that shows nothing — the whole
 * value of the Call Quality screen is that its numbers survive scrutiny, and
 * that reputation is shared.
 *
 * When this becomes real, replace this module with the same shape from the API.
 */

export type Speaker = "agent" | "caller";

export type Moment = {
  atMs: number;
  speaker: Speaker;
  text: string;
  /** Milliseconds the agent took to begin replying to the preceding turn. */
  responseMs?: number;
  note?: string;
  flag?: "good" | "warn" | "bad";
};

export type CapturedField = { field: string; value: string; ok: boolean };

export type RiskLevel = "clear" | "review" | "blocked";

export type AgentCall = {
  id: string;
  from: string;
  startedAt: string;
  durationMs: number;
  /** 0–100 across all four dimensions. */
  overall: number;
  responsiveness: {
    score: number;
    firstResponseMs: number;
    medianResponseMs: number;
    slowestResponseMs: number;
    /** Share of caller interruptions the agent yielded to promptly. */
    bargeInHandledPct: number;
    awkwardSilences: number;
  };
  tone: {
    score: number;
    label: string;
    warmth: number;
    respect: number;
    helpfulness: number;
    clarity: number;
  };
  effectiveness: {
    score: number;
    questionsAsked: number;
    questionsResolved: number;
    captured: CapturedField[];
    escalated: boolean;
    summary: string;
  };
  risk: {
    level: RiskLevel;
    score: number;
    signals: string[];
    recommendation: string;
  };
  moments: Moment[];
};

export const AGENT_CALLS: AgentCall[] = [
  {
    id: "a1",
    from: "+14155550188",
    startedAt: "2026-09-11T09:42:10.000Z",
    durationMs: 184_000,
    overall: 92,
    responsiveness: {
      score: 94,
      firstResponseMs: 410,
      medianResponseMs: 620,
      slowestResponseMs: 1_180,
      bargeInHandledPct: 100,
      awkwardSilences: 0,
    },
    tone: {
      score: 91,
      label: "Warm and professional",
      warmth: 88,
      respect: 96,
      helpfulness: 93,
      clarity: 90,
    },
    effectiveness: {
      score: 90,
      questionsAsked: 4,
      questionsResolved: 4,
      captured: [
        { field: "Name", value: "Amara Osei", ok: true },
        { field: "Appointment date", value: "24 September, 10:30", ok: true },
        { field: "Callback number", value: "+1 415 555 0188", ok: true },
      ],
      escalated: false,
      summary: "Booked an appointment and confirmed the details back to the caller.",
    },
    risk: {
      level: "clear",
      score: 3,
      signals: [],
      recommendation: "No action. Nothing in this call resembles a known fraud pattern.",
    },
    moments: [
      { atMs: 400, speaker: "agent", text: "Good morning, thanks for calling Northside Dental — how can I help?", responseMs: 410, flag: "good", note: "Greeting began before the caller had to prompt." },
      { atMs: 5_200, speaker: "caller", text: "Hi, I'd like to move my appointment next week." },
      { atMs: 5_900, speaker: "agent", text: "Of course. Can I take your name?", responseMs: 700 },
      { atMs: 9_100, speaker: "caller", text: "Amara Osei — actually, sorry, can we make it the morning?" },
      { atMs: 9_500, speaker: "agent", text: "Absolutely, mornings it is.", responseMs: 400, flag: "good", note: "Yielded immediately when the caller changed direction mid-sentence." },
      { atMs: 42_000, speaker: "agent", text: "That's Tuesday the 24th at 10:30. Shall I confirm it?", responseMs: 610, flag: "good", note: "Read the captured details back before committing." },
    ],
  },
  {
    id: "a2",
    from: "+12025550143",
    startedAt: "2026-09-11T08:15:44.000Z",
    durationMs: 267_000,
    overall: 64,
    responsiveness: {
      score: 52,
      firstResponseMs: 2_400,
      medianResponseMs: 1_900,
      slowestResponseMs: 4_600,
      bargeInHandledPct: 40,
      awkwardSilences: 3,
    },
    tone: {
      score: 71,
      label: "Correct but flat",
      warmth: 54,
      respect: 88,
      helpfulness: 70,
      clarity: 72,
    },
    effectiveness: {
      score: 68,
      questionsAsked: 5,
      questionsResolved: 3,
      captured: [
        { field: "Name", value: "D. Whitfield", ok: true },
        { field: "Policy number", value: "captured incorrectly", ok: false },
        { field: "Callback number", value: "not captured", ok: false },
      ],
      escalated: true,
      summary: "Answered the billing question but could not verify the policy; handed to a person.",
    },
    risk: {
      level: "clear",
      score: 8,
      signals: [],
      recommendation: "No action.",
    },
    moments: [
      { atMs: 2_400, speaker: "agent", text: "Thank you for calling. Please state the reason for your call.", responseMs: 2_400, flag: "warn", note: "2.4s of silence before the greeting — callers often speak into the gap." },
      { atMs: 11_000, speaker: "caller", text: "I'm calling about a charge on my— " },
      { atMs: 12_800, speaker: "agent", text: "Please state the reason for your call.", responseMs: 1_800, flag: "bad", note: "Talked over the caller and repeated itself instead of yielding." },
      { atMs: 58_000, speaker: "caller", text: "It's policy four four two one, alpha." },
      { atMs: 62_600, speaker: "agent", text: "I have policy four four two one. Is that correct?", responseMs: 4_600, flag: "bad", note: "Dropped the final character and did not re-confirm." },
    ],
  },
  {
    id: "a3",
    from: "+18005550111",
    startedAt: "2026-09-11T07:03:02.000Z",
    durationMs: 51_000,
    overall: 21,
    responsiveness: {
      score: 70,
      firstResponseMs: 700,
      medianResponseMs: 900,
      slowestResponseMs: 1_500,
      bargeInHandledPct: 80,
      awkwardSilences: 0,
    },
    tone: {
      score: 44,
      label: "Pressuring",
      warmth: 30,
      respect: 38,
      helpfulness: 44,
      clarity: 64,
    },
    effectiveness: {
      score: 12,
      questionsAsked: 6,
      questionsResolved: 0,
      captured: [],
      escalated: false,
      summary: "Caller attempted to obtain account credentials. No legitimate request was made.",
    },
    risk: {
      level: "blocked",
      score: 94,
      signals: [
        "Requested a one-time passcode from the recipient",
        "Claimed to be calling from the recipient's bank",
        "Created urgency — 'your account will be suspended in ten minutes'",
        "Caller ID does not match the organisation named",
      ],
      recommendation:
        "Flagged for review and the number added to the watch list. Retain the recording — this pattern is reportable to the FCC and to the named institution's fraud team.",
    },
    moments: [
      { atMs: 700, speaker: "caller", text: "This is the fraud department at your bank. We need to verify your identity." },
      { atMs: 8_400, speaker: "caller", text: "Read me the six-digit code we just sent you.", flag: "bad", note: "Credential harvesting — a legitimate institution never asks for this." },
      { atMs: 14_100, speaker: "agent", text: "I'm not able to share verification codes. I can transfer you to our team if you'd like.", responseMs: 900, flag: "good", note: "Refused correctly and did not disclose anything." },
      { atMs: 22_000, speaker: "caller", text: "Your account will be suspended in ten minutes if you don't comply.", flag: "bad", note: "Manufactured urgency, a standard pressure tactic." },
    ],
  },
];

export const DIMENSIONS = [
  {
    key: "responsiveness" as const,
    label: "Responsiveness",
    blurb: "How quickly and naturally the agent replies, and whether it yields when interrupted.",
  },
  {
    key: "tone" as const,
    label: "Tone",
    blurb: "Whether the agent came across as warm, respectful, helpful and clear.",
  },
  {
    key: "effectiveness" as const,
    label: "Effectiveness",
    blurb: "Whether the caller's questions were answered and their details captured correctly.",
  },
  {
    key: "risk" as const,
    label: "Safety",
    blurb: "Whether the call shows signs of fraud, phishing or abuse worth flagging.",
  },
];
