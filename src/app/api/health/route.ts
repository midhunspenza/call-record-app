import { NextResponse } from "next/server";
import { eventBus } from "@/server/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    bus: eventBus.stats(),
  });
}
