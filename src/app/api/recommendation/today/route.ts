import { NextResponse } from "next/server";
import { getBeijingDateKey } from "@/lib/beijing-time";
import { toCardDTO } from "@/lib/articles";
import { getTodayRecommendation, selectDailyRecommendation } from "@/lib/pipeline/recommendation";

export const dynamic = "force-dynamic";

export async function GET() {
  const date = getBeijingDateKey();
  const rec = (await getTodayRecommendation()) ?? (await selectDailyRecommendation());

  if (!rec) {
    return NextResponse.json({ date, article: null, recommendSource: null, reason: "", score: 0 });
  }

  const article = rec.article;
  return NextResponse.json({
    date,
    article: toCardDTO({
      ...article,
      recommendSource: rec.recommendSource,
      recommendationReason: rec.reason ?? "",
      recommendationScore: rec.score ?? 0,
    }),
    recommendSource: rec.recommendSource,
    reason: rec.reason ?? "",
    score: rec.score ?? 0,
  });
}
