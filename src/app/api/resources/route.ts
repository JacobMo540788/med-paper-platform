import { NextRequest, NextResponse } from "next/server";
import { getResourceFacets, parseResourceSearchParams, searchUrologyResources } from "@/lib/urology-resources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = parseResourceSearchParams(req.nextUrl.searchParams);
    const [result, facets] = await Promise.all([
      searchUrologyResources(params),
      getResourceFacets(params.resourceKind),
    ]);
    return NextResponse.json({ success: true, ...result, facets });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
