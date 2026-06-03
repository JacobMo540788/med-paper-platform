import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const result = await prisma.article.deleteMany({
    where: {
      OR: [
        { source: "SEED" },
        { doi: { startsWith: "10.1038/demo-" } },
        { doi: { startsWith: "10.1056/demo-" } },
        { pmid: { startsWith: "demo-" } },
      ],
    },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
