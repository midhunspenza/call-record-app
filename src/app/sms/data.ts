export type NumberRow = {
  id: string;
  num: string;
  country: string;
  unread: number;
  last: string;
};

export type MessageStatus = "delivered" | "pending" | "failed";

export type Message = {
  dir: "in" | "out";
  text: string;
  ms: number;
  status: MessageStatus;
  errCode: string | null;
};

export type Conversation = {
  id: string;
  spenzaNumberId: string;
  peerDisplay: string;
  contactName: string;
  msgs: Message[];
  hasFailure: boolean;
  lastMs: number;
  lastDir: "in" | "out";
  lastText: string;
};

export const NUMBERS: NumberRow[] = [
  { id: "n1",  num: "+1 415 555 0142", country: "🇺🇸", unread: 4, last: "Got it, thanks!" },
  { id: "n2",  num: "+1 312 555 0911", country: "🇺🇸", unread: 0, last: "We'll need an updated MSA." },
  { id: "n3",  num: "+1 646 555 0078", country: "🇺🇸", unread: 2, last: "Sure, sending the code now." },
  { id: "n4",  num: "+91 80 4567 1208", country: "🇮🇳", unread: 7, last: "Pool already at 92% capacity." },
  { id: "n5",  num: "+91 22 6789 0012", country: "🇮🇳", unread: 0, last: "Activation went through, thanks." },
  { id: "n6",  num: "+91 11 3344 1290", country: "🇮🇳", unread: 1, last: "Pls share the rate sheet." },
  { id: "n7",  num: "+44 20 7946 1109", country: "🇬🇧", unread: 0, last: "Ticket #4471 escalated." },
  { id: "n8",  num: "+44 113 4960 219", country: "🇬🇧", unread: 0, last: "All quiet on this line." },
  { id: "n9",  num: "+65 6123 4001",    country: "🇸🇬", unread: 3, last: "Routing change live at 02:00 SGT." },
  { id: "n10", num: "+65 6555 8814",    country: "🇸🇬", unread: 0, last: "Confirmed receipt of CDR." },
  { id: "n11", num: "+1 212 555 0166", country: "🇺🇸", unread: 0, last: "Resend the OTP please." },
  { id: "n12", num: "+1 415 555 0107", country: "🇺🇸", unread: 0, last: "Trunk capacity normal." },
];

const FIRST_NAMES = ["Marcus", "Eleanor", "Vikram", "Ananya", "Diego", "Mei", "Priya", "Daniel", "Henrik", "Yuki", "Tomás", "Aarav", "Linnea", "Olu", "Sana"];
const LAST_NAMES = ["Hale", "Whitcomb", "Bose", "Reyes", "Park", "Singh", "Sundberg", "Liu", "Olu", "Quinn", "Tanaka"];
const PEER_NUMS_US = ["+1 415 555 0312","+1 646 555 0998","+1 312 555 0145","+1 510 555 0211","+1 305 555 0844","+1 718 555 0067","+1 213 555 0399"];
const PEER_NUMS_IN = ["+91 98 7642 0014","+91 80 9234 1287","+91 99 8821 4456","+91 22 5567 1129"];
const PEER_NUMS_UK = ["+44 7700 900142","+44 7700 900981","+44 7700 900043"];
const PEER_NUMS_SG = ["+65 8344 6612","+65 9128 7710"];

const SAMPLE = {
  inbound: [
    "Hi, I'd like to port my number to Spenza.",
    "Can you resend the OTP, please?",
    "The activation QR isn't scanning, second attempt now.",
    "We're hitting trunk capacity again, can you bump us to 14 channels?",
    "Are the new rates active from today?",
    "What's the latency on the Mumbai pool right now?",
    "Need a CDR export for last week's calls.",
    "Got the invoice, finance has a question.",
    "Confirming receipt of your message.",
    "Got it, thanks!",
    "When does the maintenance window start?",
    "Routing change is showing for our SG number, can you verify?",
    "Sure, sending the code now.",
    "Pls share the rate sheet.",
    "Could you escalate this ticket?",
  ],
  outbound: [
    "Sure, I can help with that. What's the order reference?",
    "Sending the port-in form to your inbox now.",
    "Code: 4821. It expires in 10 minutes.",
    "Bumping you to 14 channels temporarily, monitor the burst.",
    "Yes, new rates went live at 00:00 UTC.",
    "Mumbai pool latency is 84ms, well within SLA.",
    "CDR export queued, you'll get the link in ~3 minutes.",
    "Happy to help, what's the invoice number?",
    "Acknowledged. Looping in our porting desk.",
    "Sent. Anything else I can help with?",
    "Maintenance window: 02:00–02:30 UTC tonight.",
    "Routing change is live, ping me if you see any anomalies.",
    "Pool already at 92% capacity. We're provisioning more.",
    "Activation went through, thanks.",
    "Trunk capacity normal across all regions.",
  ],
};

// Seeded PRNG so SSR and CSR generate identical data — prevents hydration mismatches.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(987654321);
const rand = (a: number, b: number) => Math.floor(a + rng() * (b - a));
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

// Frozen "now" so durations don't shift between server render and client hydration.
// The list-relative-time renderer rounds aggressively so this drift is invisible after mount.
const NOW = 1747584000000; // 2025-05-18 16:00 UTC, fixed seed

function genMessages(count: number): Message[] {
  const out: Message[] = [];
  let t = NOW - rand(2, 14) * 24 * 3600 * 1000;
  for (let i = 0; i < count; i++) {
    const dir: "in" | "out" = i === 0 ? "in" : rng() < 0.5 ? "in" : "out";
    const text = pick(dir === "in" ? SAMPLE.inbound : SAMPLE.outbound);
    t += rand(20, 240) * 60 * 1000;
    if (t > NOW) t = NOW - rand(0, 30) * 60 * 1000;
    let status: MessageStatus = "delivered";
    let errCode: string | null = null;
    if (dir === "out") {
      const r = rng();
      if (r < 0.04) {
        status = "failed";
        errCode = "30007";
      } else if (r < 0.08) {
        status = "pending";
      }
    }
    out.push({ dir, text, ms: t, status, errCode });
  }
  out.sort((a, b) => a.ms - b.ms);
  return out;
}

export const CONVERSATIONS: Conversation[] = (() => {
  const all: Conversation[] = [];
  let id = 0;
  NUMBERS.forEach((n) => {
    const peers =
      n.country === "🇮🇳" ? PEER_NUMS_IN
      : n.country === "🇬🇧" ? PEER_NUMS_UK
      : n.country === "🇸🇬" ? PEER_NUMS_SG
      : PEER_NUMS_US;
    const convoCount = rand(8, 22);
    for (let i = 0; i < convoCount; i++) {
      const msgs = genMessages(rand(5, 30));
      const last = msgs[msgs.length - 1];
      all.push({
        id: `c${++id}`,
        spenzaNumberId: n.id,
        peerDisplay: peers[i % peers.length],
        contactName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        msgs,
        hasFailure: msgs.some((m) => m.status === "failed"),
        lastMs: last.ms,
        lastDir: last.dir,
        lastText: last.text,
      });
    }
  });
  return all;
})();

export function fmtTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtRelTime(ms: number, now: number = NOW) {
  const diff = now - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(ms);
  return `${date.toLocaleString("en-US", { month: "short" })} ${date.getDate()}`;
}

export function fmtDateSep(ms: number, now: number = NOW) {
  const d = new Date(ms);
  const today = new Date(now);
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(now - 24 * 3600 * 1000);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
