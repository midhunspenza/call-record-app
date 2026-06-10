/**
 * Phone-number display helpers.
 *
 * spenza-backend stores phone numbers verbatim from Joonto, which is
 * asymmetric: `from` usually has the country code (15551234567) but `did`/`to`
 * arrives bare (5559998888). The S3 object key inherits that asymmetry — so
 * display-side normalization keeps the UI consistent even when the raw data
 * is messy.
 *
 * The format functions never mutate the source — they're for rendering only.
 */

/** Strip everything except digits. */
export function digitsOnly(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[^0-9]/g, "");
}

/**
 * Normalize a phone number to E.164 digits (no `+`).
 * Bare 10-digit US/CA numbers get a `1` country-code prefix; everything else is
 * left alone so international numbers (e.g. 442079461109) keep their prefix.
 */
export function normalizeE164Digits(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (d.length === 10) return "1" + d;
  return d;
}

/**
 * Format a raw phone string for display.
 *
 *   "5551234567"     → "+1 (555) 123-4567"
 *   "15551234567"    → "+1 (555) 123-4567"
 *   "+1 555-123-4567"→ "+1 (555) 123-4567"
 *   "442079461109"   → "+44 20 7946 1109"   (UK-style hint)
 *   "919876543210"   → "+91 98765 43210"    (IN-style hint)
 *   "" / undefined   → "—"
 *   anything else    → "+<digits>"          (safe fallback)
 *
 * The international formatting heuristics are best-effort — for a real product
 * pull in libphonenumber. For our admin UI a clean +CC grouping is enough.
 */
export function formatPhone(input: string | null | undefined): string {
  const d = normalizeE164Digits(input);
  if (!d) return "—";

  // North America (NANP): 1 + NXX-NXX-XXXX
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }

  // UK: +44 + 10 digits (2-4-4 grouping is the common London/mobile pattern)
  if (d.length === 12 && d.startsWith("44")) {
    return `+44 ${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
  }

  // India: +91 + 10-digit mobile (5-5 grouping)
  if (d.length === 12 && d.startsWith("91")) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }

  // Generic: +CC <rest> grouped in 3s so long numbers stay readable.
  if (d.length > 10) {
    const cc = d.slice(0, d.length - 10);
    const local = d.slice(d.length - 10);
    return `+${cc} ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  // Falls below the typical international length — best effort.
  return `+${d}`;
}

/**
 * Parse a spenza-backend S3 recording key into its semantic pieces.
 *
 * Key format (see voice-stream.gateway.ts):
 *   {from}-{to}-{direction}-{callId}-{timestamp}-{rand}.wav
 *
 * Both phone numbers are passed through `formatPhone` for display, so
 * asymmetric country-code handling on the backend doesn't matter to the UI.
 *
 * Returns null shape for the unparseable case so callers can fall back to raw.
 */
export type ParsedRecordingKey = {
  fromRaw: string;
  toRaw: string;
  from: string;       // display-formatted
  to: string;         // display-formatted
  direction: "in" | "out" | null;
  callId: string | null;
  timestampMs: number | null;
};

export function parseRecordingKey(s3Key: string): ParsedRecordingKey | null {
  const filename = s3Key.split("/").pop() ?? s3Key;
  const noExt = filename.replace(/\.[a-z0-9]+$/i, "");
  const parts = noExt.split("-");
  if (parts.length < 3) return null;

  const fromRaw = parts[0];
  const toRaw = parts[1];
  const dir = parts[2];
  const direction: "in" | "out" | null = dir === "in" || dir === "out" ? dir : null;

  // callId can contain `-` after sanitization, but timestamp + random sit at
  // the tail. Walk back from the end: last token is rand, second-to-last is
  // a 13-digit epoch ms. Everything between direction and timestamp is callId.
  let timestampMs: number | null = null;
  let callId: string | null = null;
  if (parts.length >= 5) {
    const maybeTs = parts[parts.length - 2];
    if (/^\d{13}$/.test(maybeTs)) {
      timestampMs = Number(maybeTs);
      callId = parts.slice(3, parts.length - 2).join("-") || null;
    } else {
      callId = parts.slice(3).join("-") || null;
    }
  } else if (parts.length === 4) {
    callId = parts[3];
  }

  return {
    fromRaw,
    toRaw,
    from: formatPhone(fromRaw),
    to: formatPhone(toRaw),
    direction,
    callId,
    timestampMs,
  };
}
