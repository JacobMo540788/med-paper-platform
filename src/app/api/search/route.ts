import { NextRequest, NextResponse } from "next/server";
import { parseResourceSearchParams, searchUrologyResources } from "@/lib/urology-resources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = parseResourceSearchParams(req.nextUrl.searchParams);
    const result = await searchUrologyResources({ ...params, resourceKind: params.resourceKind ?? "ALL" });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
