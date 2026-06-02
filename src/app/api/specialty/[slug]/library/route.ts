import { NextRequest, NextResponse } from "next/server";
import type { Specialty, StudyType } from "@prisma/client";
import { specialtyFromSlug } from "@/lib/constants";
import { searchSpecialtyLibrary, type LibrarySort, type LibraryType } from "@/lib/library";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params;
  const specialty = specialtyFromSlug(slug);
  if (!specialty) {
    return NextResponse.json({ success: false, error: "unknown specialty" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const libraryType = (sp.get("type") ?? "history") as LibraryType;
  if (libraryType !== "history" && libraryType !== "core") {
    return NextResponse.json({ success: false, error: "invalid type" }, { status: 400 });
  }

  const result = await searchSpecialtyLibrary({
    specialty: specialty as Specialty,
    libraryType,
    q: sp.get("q") ?? undefined,
    studyType: (sp.get("studyType") as StudyType) || undefined,
    minIf: sp.get("minIf") ? parseFloat(sp.get("minIf")!) : undefined,
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    sort: (sp.get("sort") as LibrarySort) || undefined,
    order: (sp.get("order") as "asc" | "desc") || undefined,
    page: sp.get("page") ? parseInt(sp.get("page")!, 10) : 1,
  });

  return NextResponse.json({ success: true, ...result });
}
