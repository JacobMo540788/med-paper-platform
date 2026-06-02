import { NextResponse } from "next/server";
import { getArticleById, getRelatedArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const article = await getArticleById(id);
    if (!article) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const related = await getRelatedArticles(id, article.specialty);
    return NextResponse.json({ success: true, data: article, related });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
