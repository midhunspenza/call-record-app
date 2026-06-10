/**
 * Custom Next.js server.
 *
 * Why custom: Next App Router doesn't expose the HTTP server, so we can't
 * attach a WebSocket to a vanilla `next dev`. This wraps Next and shares
 * the HTTP server with our /api/stream WebSocket.
 *
 * In production, run `npm run build && npm start` — both use this server.
 * If we ever move to a serverless host, the WS endpoint will need to move to
 * an external broker (Redis pub/sub + a separate WS process, Pusher, Ably).
 */

import { createServer } from "node:http";
import next from "next";
import { loadEnvConfig } from "@next/env";
import { attachWebsocket } from "./src/server/ws";
import { registerWebhooksFromEnv } from "./src/server/registration";

// Load .env / .env.local / .env.{development,production}[.local] into process.env
// BEFORE any of our own code reads it. Next loads these inside `next()` for the
// Next runtime, but our custom server reads process.env directly, so we load
// them here too. Matches the precedence Next docs document.
const dev = process.env.NODE_ENV !== "production";
loadEnvConfig(process.cwd(), dev);

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => {
    // Let Next handle every HTTP route, including /api/webhooks/*
    handle(req, res).catch((err) => {
      console.error("[next] request error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });

  attachWebsocket(server);

  server.listen(port, hostname, () => {
    const host = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`▶ Spenza Console ready at http://${host}:${port}`);
    console.log(`▶ WebSocket stream:    ws://${host}:${port}/api/stream`);
    // Fire-and-forget so a slow spenza-backend response doesn't delay readiness.
    void registerWebhooksFromEnv();
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      console.log(`\n[server] received ${signal}, draining…`);
      server.close(() => process.exit(0));
      // Belt-and-suspenders: force exit if drain hangs.
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
