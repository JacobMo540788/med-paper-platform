import { NextRequest, NextResponse } from "next/server";
import { toCardDTO } from "@/lib/articles";
import { listRecommendationHistory } from "@/lib/pipeline/recommendation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const result = await listRecommendationHistory(page, limit);

  return NextResponse.json({
    ...result,
    items: result.items.map((item) => ({
      id: item.id,
      date: item.dateKey,
      recommendSource: item.recommendSource,
      reason: item.reason,
      score: item.score,
      article: toCardDTO({
        ...item.article,
        recommendSource: item.recommendSource,
        recommendationReason: item.reason ?? "",
        recommendationScore: item.score ?? 0,
      }),
    })),
  });
}
