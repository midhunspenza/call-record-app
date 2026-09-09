import { NextResponse } from "next/server";
import { qosStore } from "@/server/qos-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * History for the /qos screen (ISIM-718).
 *
 * The page seeds from here on mount and then follows the live WebSocket, the
 * same shape the SMS and Voice screens use. Without the seed, a freshly opened
 * tab would show nothing until the next call completed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const number = url.searchParams.get("number") ?? undefined;

  const [reports, stats] = await Promise.all([
    qosStore.list({
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100,
      number,
    }),
    qosStore.stats(),
  ]);

  return NextResponse.json({ reports, stats });
}
