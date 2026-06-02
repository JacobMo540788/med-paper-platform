import { NextRequest, NextResponse } from "next/server";
import { runCoreLibrarySyncAll } from "@/lib/pipeline/core-library";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = req.headers.get("authorization");
  const legacySecret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");

  return authorization === `Bearer ${cronSecret}` || legacySecret === cronSecret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCoreLibrarySyncAll();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Core sync failed" },
      { status: 500 }
    );
  }
}
