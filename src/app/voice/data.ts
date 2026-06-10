export type CallDirection = "in" | "out";

export type Call = {
  id: string;
  from: string;
  to: string;
  direction: CallDirection;
  durationStart: number;
  streaming: boolean;
  did?: string;
  callId?: string;
  trunk: string;
  codec: string;
  rtpPort: string;
  fromDomain?: string;
  startedAt?: string;
  keywords?: string[];
  speakers: { agent: string; customer: string };
  snippet: string;
};

export const CALLS: Call[] = [
  {
    id: "call-1",
    from: "+1 415 555 0142",
    to: "+91 80 4567 1208",
    direction: "in",
    durationStart: Date.now() - 4 * 60 * 1000 - 12 * 1000,
    streaming: true,
    trunk: "SpenzaJ",
    codec: "ulaw",
    rtpPort: "10882",
    fromDomain: "twilio.bay-2.sip",
    startedAt: "14:27:51",
    keywords: ["esim activation", "port-in", "verification code", "billing", "trunk capacity"],
    speakers: { agent: "Priya · Spenza Ops", customer: "Marcus Hale" },
    snippet: "Yes, the activation code was sent to your registered…",
  },
  {
    id: "call-2",
    from: "+91 98 7642 0014",
    to: "+1 312 555 0911",
    direction: "out",
    durationStart: Date.now() - 1 * 60 * 1000 - 38 * 1000,
    streaming: true,
    trunk: "Bandwidth-A",
    codec: "opus",
    rtpPort: "11204",
    snippet: "Can you confirm the DID range for the Mumbai pool?",
    speakers: { agent: "Vikram · Spenza Ops", customer: "Ankur Bose" },
  },
  {
    id: "call-3",
    from: "+44 20 7946 1109",
    to: "+1 415 555 0107",
    direction: "in",
    durationStart: Date.now() - 28 * 1000,
    streaming: true,
    trunk: "SpenzaJ",
    codec: "ulaw",
    rtpPort: "10994",
    snippet: "Hi, I'm calling about porting two of our toll-free…",
    speakers: { agent: "Priya · Spenza Ops", customer: "Eleanor Whitcomb" },
  },
];

export const TRANSCRIPT_SEED: Array<[string, string]> = [
  ["agent", "Thank you for calling Spenza, this is Priya. How can I help you today?"],
  ["customer", "Hi Priya, this is Marcus from Hale Logistics. I'm trying to activate the eSIM you shipped us last week."],
  ["agent", "Of course, let me pull that up. Can I get the order reference please?"],
  ["customer", "Yes, it's SPN dash 4 7 2 1 dash A."],
  ["agent", "Got it. I can see the order, it shipped to your San Francisco office on the 12th."],
  ["customer", "Right, we got the QR codes today. The first activation went through fine but the second one is stuck on 'pending'."],
  ["agent", "Let me check the provisioning queue. One moment, Marcus."],
  ["customer", "No problem."],
  ["agent", "Okay, I see it. The IMSI is provisioned but the HLR sync hasn't completed yet, that's why it shows pending."],
  ["customer", "How long does that usually take?"],
  ["agent", "Normally under five minutes, but the South Asia carrier had a brief delay this morning. I'm pushing a manual sync now."],
  ["customer", "Appreciate it. Will I see anything on my end when it's done?"],
  ["agent", "Yes, the activation code was sent to your registered email. Once the sync completes, scanning the QR code will work right away."],
  ["customer", "Perfect. And on billing, do these two lines get pooled with our existing US numbers?"],
  ["agent", "They will. You're on the shared bucket, so data and minutes pool across the whole account."],
  ["customer", "Great. One more thing, our finance team had a question about last month's reconciliation."],
];

export const TRANSCRIPT_STREAM: Array<[string, string]> = [
  ["agent", "Sure, what's the question?"],
  ["customer", "We were billed for 14 trunk channels but our contract is for 12."],
  ["agent", "Let me look at the invoice. Can you give me the invoice number?"],
  ["customer", "It's I N V dash 2 0 2 5 dash 1 1 dash 0 8 8 4."],
  ["agent", "Pulling it up now. I see the line item, that's the burst capacity you used during the November launch event."],
  ["customer", "Oh right, the marketing webinar. That makes sense."],
  ["agent", "It's billed at the contracted overage rate, but I can send you the call detail records so finance can verify."],
  ["customer", "Yes please, that would help."],
  ["agent", "Sending them to your billing contact now. Anything else I can help with?"],
  ["customer", "That's everything for today. Thanks Priya, you've been great."],
  ["agent", "Happy to help. I'll keep an eye on the eSIM sync and ping you if anything looks off."],
];

export function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function fmtTC(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function fmtTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
