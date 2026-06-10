import { NextResponse } from "next/server";
import { listRecordings } from "@/server/s3-recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listRecordings();
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[recordings] list failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
