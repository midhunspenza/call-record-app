import { NextResponse } from "next/server";
import { getRecordingUrl } from "@/server/s3-recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }
  try {
    const url = await getRecordingUrl(key);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[recordings] presign failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
