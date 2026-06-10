import { SpenzaApi, RegisterWebhookInput } from "./spenza-api";

/**
 * Boot-time self-registration against POST /api/v1/webhooks/register.
 *
 * Idempotent: the doc says calling register again with the same
 * (operator, network) updates the existing row, so this is safe to run on every
 * start. If any required env var is missing we skip silently rather than crash
 * the server — local devs without spenza-backend credentials still get a
 * working UI.
 *
 * Registers a single record with eventType="both", carrying both the SMS
 * webhook URLs and the voice URLs (HTTP receivers + the WS stream URL).
 */

export type RegistrationEnv = {
  SPENZA_API_BASE_URL?: string;
  SPENZA_API_KEY?: string;
  SPENZA_API_SECRET?: string;
  SPENZA_OPERATOR?: string;
  SPENZA_NETWORK?: string;
  WEBHOOK_PUBLIC_URL?: string;
  WEBHOOK_BASIC_USER?: string;
  WEBHOOK_BASIC_PASS?: string;
};

/**
 * Derive a wss:// (or ws://) URL from the public HTTP base URL. ngrok routes
 * both schemes through the same hostname, so we just swap the protocol.
 */
function toWsUrl(publicUrl: string): string {
  if (publicUrl.startsWith("https://")) return publicUrl.replace(/^https:/, "wss:");
  if (publicUrl.startsWith("http://")) return publicUrl.replace(/^http:/, "ws:");
  return publicUrl;
}

export async function registerWebhooksFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const required = [
    "SPENZA_API_BASE_URL",
    "SPENZA_API_KEY",
    "SPENZA_API_SECRET",
    "SPENZA_OPERATOR",
    "SPENZA_NETWORK",
    "WEBHOOK_PUBLIC_URL",
  ] as const;
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    console.log(`[register] skipped — missing env: ${missing.join(", ")}`);
    return { skipped: true as const, missing };
  }

  const api = new SpenzaApi({
    baseUrl: env.SPENZA_API_BASE_URL!,
    apiKey: env.SPENZA_API_KEY!,
    apiSecret: env.SPENZA_API_SECRET!,
  });

  const publicUrl = env.WEBHOOK_PUBLIC_URL!.replace(/\/$/, "");
  const wsBase = toWsUrl(publicUrl);

  // Always register with type=none, regardless of WEBHOOK_BASIC_* in env.
  // spenza-backend's delivery worker is currently NOT attaching the
  // Authorization header on outbound webhook POSTs or WS upgrades (verified
  // for both SMS and voice paths). So storing basic creds we'll never see
  // would just leave the gate rejecting every delivery. The env vars are
  // still respected by the receiver/WS code for local-curl testing.
  const authentication = { type: "none" } as const;

  const input: RegisterWebhookInput = {
    operator: env.SPENZA_OPERATOR!,
    network: env.SPENZA_NETWORK!,
    eventType: "both",
    authentication,
    webhookUrls: {
      messageUrl: `${publicUrl}/api/webhooks/sms/incoming`,
      callbackMessageUrl: `${publicUrl}/api/webhooks/sms/status`,
      voiceUrl: `${publicUrl}/api/webhooks/voice/incoming`,
      callbackVoiceUrl: `${publicUrl}/api/webhooks/voice/status`,
      voiceStreamUrl: `${wsBase}/api/ws/voice/incoming`,
    },
    status: "active",
    description: "spenza-console (auto-registered on boot)",
  };

  try {
    const reg = await api.registerWebhook(input);
    console.log(
      `[register] ✔ ${reg.operator}/${reg.network} eventType=${reg.eventType} id=${reg.registrationId}`,
    );
    console.log(`[register]   messageUrl:         ${reg.webhookUrls.messageUrl}`);
    console.log(`[register]   callbackMessageUrl: ${reg.webhookUrls.callbackMessageUrl}`);
    console.log(`[register]   voiceUrl:           ${reg.webhookUrls.voiceUrl}`);
    console.log(`[register]   callbackVoiceUrl:   ${reg.webhookUrls.callbackVoiceUrl}`);
    console.log(`[register]   voiceStreamUrl:     ${reg.webhookUrls.voiceStreamUrl}`);
    return { skipped: false as const, registration: reg };
  } catch (err) {
    // Never crash startup just because registration failed — the UI is still
    // useful, and we want a chance to inspect the error in the logs and retry.
    console.error("[register] ✖ failed:", err instanceof Error ? err.message : err);
    return { skipped: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}
