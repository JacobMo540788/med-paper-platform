import { NextRequest, NextResponse } from "next/server";
import type { Specialty, StudyType } from "@prisma/client";
import { searchArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const result = await searchArticles({
      q: sp.get("q") ?? undefined,
      specialty: (sp.get("specialty") as Specialty) || undefined,
      studyType: (sp.get("studyType") as StudyType) || undefined,
      minIf: sp.get("minIf") ? parseFloat(sp.get("minIf")!) : undefined,
      page: sp.get("page") ? parseInt(sp.get("page")!, 10) : 1,
      limit: sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 20,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
