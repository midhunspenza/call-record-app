/**
 * Thin typed client for the documented spenza-backend API.
 * Only endpoints from api-documentation.html are wrapped — nothing else.
 *
 *   GET    /api/v1/authenticate          (yes, GET with body — see authenticate())
 *   POST   /api/v1/webhooks/register
 *   GET    /api/v1/webhooks/registrations
 *   DELETE /api/v1/webhooks/registrations/:id
 *
 * Server-only: holds the API key/secret, caches the Bearer token until expiry,
 * and lazily re-authenticates. Never imported from a client component.
 */

import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

export type SpenzaApiConfig = {
  baseUrl: string;     // e.g. https://api.spenza.com
  apiKey: string;
  apiSecret: string;
};

export type WebhookAuthentication =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "api_key"; apiKey: string; apiKeyHeader?: string };

export type RetryPolicy = {
  maxAttempts?: number;
  backoffStrategy?: "fixed" | "exponential" | "linear";
  initialDelaySeconds?: number;
  maxDelaySeconds?: number;
};

export type WebhookUrls = {
  messageUrl?: string;
  callbackMessageUrl?: string;
  voiceUrl?: string;
  callbackVoiceUrl?: string;
  /**
   * WebSocket URL for live voice media. Spenza opens an outbound WS to this URL
   * when a Joonto voice WS connects, sends a JSON handshake frame first, then
   * raw binary PCM (8 kHz, 16-bit, mono) frames in real time.
   */
  voiceStreamUrl?: string;
};

export type RegisterWebhookInput = {
  operator: string;       // e.g. "SpenzaJ"
  network: string;        // e.g. "SpenzaJ"
  eventType: "sms" | "voice" | "both";
  authentication: WebhookAuthentication;
  webhookUrls: WebhookUrls;
  retryPolicy?: RetryPolicy;
  status?: "active" | "inactive";
  description?: string;
};

export type Registration = {
  registrationId: string;
  operator: string;
  network: string;
  eventType: string;
  status: string;
  authentication: WebhookAuthentication & { password?: string; token?: string; apiKey?: string };
  webhookUrls: WebhookUrls;
  retryPolicy?: RetryPolicy;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export class SpenzaApi {
  private token: { value: string; expiresAt: number } | null = null;
  // Pre-emptively refresh a minute before the server says the token expires.
  private readonly skewMs = 60_000;

  constructor(private readonly cfg: SpenzaApiConfig) {}

  /**
   * GET /api/v1/authenticate — exchange key+secret for a Bearer token.
   *
   * The doc specifies GET with a JSON body, which the WHATWG fetch spec
   * forbids (and Node's fetch enforces). We use the lower-level http(s)
   * module so we can faithfully send GET-with-body as the API requires.
   */
  async authenticate(): Promise<{ accessToken: string; expiration: string }> {
    const body = JSON.stringify({ key: this.cfg.apiKey, secret: this.cfg.apiSecret });
    const url = new URL("/api/v1/authenticate", this.cfg.baseUrl);
    const lib = url.protocol === "https:" ? httpsRequest : httpRequest;
    const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = lib(
        {
          method: "GET",
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname + url.search,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
            accept: "application/json",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf-8") }),
          );
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    if (status < 200 || status >= 300) {
      throw new Error(`spenza authenticate failed: ${status} ${text}`);
    }
    const json = JSON.parse(text) as { accessToken: string; expiration: string; message?: string };
    if (!json.accessToken) throw new Error(`spenza authenticate: missing accessToken in response`);
    return json;
  }

  /** Returns a Bearer token, refreshing if the cached one is missing or near expiry. */
  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - Date.now() > this.skewMs) return this.token.value;
    const { accessToken, expiration } = await this.authenticate();
    // `expiration` is documented as a string with no fixed format. If we can parse it as a date,
    // use that; otherwise treat it as seconds-from-now; otherwise fall back to a conservative 10 min.
    let expiresAt = Date.now() + 10 * 60_000;
    if (expiration) {
      const asDate = Date.parse(expiration);
      if (!Number.isNaN(asDate)) {
        expiresAt = asDate;
      } else {
        const asNumber = Number(expiration);
        if (Number.isFinite(asNumber) && asNumber > 0) expiresAt = Date.now() + asNumber * 1000;
      }
    }
    this.token = { value: accessToken, expiresAt };
    return accessToken;
  }

  private async authed<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
        authorization: `Bearer ${token}`,
      },
    });
    // 401 once -> drop cached token and try once more, so an expired token is self-healing.
    if (res.status === 401 && this.token) {
      this.token = null;
      const retryToken = await this.getToken();
      const retry = await fetch(`${this.cfg.baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
          authorization: `Bearer ${retryToken}`,
        },
      });
      if (!retry.ok) throw new Error(`spenza ${path}: ${retry.status} ${await retry.text()}`);
      return (await retry.json()) as T;
    }
    if (!res.ok) throw new Error(`spenza ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  /** POST /api/v1/webhooks/register — idempotent per (operator, network). */
  async registerWebhook(input: RegisterWebhookInput): Promise<Registration> {
    const json = await this.authed<{ success: boolean; data: Registration; message?: string }>(
      "/api/v1/webhooks/register",
      { method: "POST", body: JSON.stringify(input) },
    );
    if (!json?.data?.registrationId) {
      throw new Error(`spenza register: unexpected response shape: ${JSON.stringify(json)}`);
    }
    return json.data;
  }

  /** GET /api/v1/webhooks/registrations — optional operator/network/eventType filters. */
  async listRegistrations(filter: { operator?: string; network?: string; eventType?: string } = {}): Promise<Registration[]> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) qs.set(k, v);
    const path = `/api/v1/webhooks/registrations${qs.toString() ? `?${qs.toString()}` : ""}`;
    const json = await this.authed<{ success: boolean; data: Registration[] }>(path);
    return json.data ?? [];
  }

  /** DELETE /api/v1/webhooks/registrations/:id */
  async deleteRegistration(id: string): Promise<void> {
    await this.authed<unknown>(`/api/v1/webhooks/registrations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
