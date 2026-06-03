import { Prisma, type Article, type Specialty } from "@prisma/client";
import { CACHE_KEYS } from "../constants";
import { prisma } from "../db";
import { decodeHtmlEntities } from "../html";
import { runFullLlmPipeline } from "../llm/analyzer";
import { cacheDel } from "../redis";

export function canRunAiAnalysis() {
  return Boolean(process.env.LLM_API_KEY);
}

export async function generateAiAnalysisForArticle(
  article: Article
): Promise<Pick<Article, "titleCn" | "abstractCn" | "aiSummary" | "aiAnalysisJson" | "keywordsBilingual"> | null> {
  if (!canRunAiAnalysis()) return null;
  if (article.verificationStatus !== "VERIFIED") return null;
  if (article.aiAnalysisJson) return null;
  if (!article.abstract?.trim()) return null;

  const titleEn = decodeHtmlEntities(article.titleEn);
  const abstract = decodeHtmlEntities(article.abstract);

  const llm = await runFullLlmPipeline({
    titleEn,
    abstract,
    specialty: article.specialty,
    studyType: article.studyType,
    journal: article.journal,
  });

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      titleEn,
      abstract,
      titleCn: llm.titleCn,
      abstractCn: llm.abstractCn,
      aiSummary: llm.aiSummary,
      aiAnalysisJson: llm.aiAnalysis,
      keywordsBilingual: llm.aiAnalysis.keywords_cn_en,
    },
    select: {
      titleCn: true,
      abstractCn: true,
      aiSummary: true,
      aiAnalysisJson: true,
      keywordsBilingual: true,
    },
  });

  await cacheDel(CACHE_KEYS.article(article.id));
  return updated;
}

export async function backfillMissingAiAnalysis(limit = 20, specialty?: Specialty) {
  if (!canRunAiAnalysis()) {
    return { selected: 0, updated: 0, failed: 0, errors: ["LLM_API_KEY is not configured."] };
  }

  const take = Math.max(1, Math.min(limit, 50));
  const articles = await prisma.article.findMany({
    where: {
      verificationStatus: "VERIFIED",
      aiAnalysisJson: { equals: Prisma.DbNull },
      abstract: { not: null },
      ...(specialty ? { specialty } : {}),
    },
    orderBy: [{ isTodayPick: "desc" }, { impactFactor: "desc" }, { publishDate: "desc" }],
    take,
  });

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const article of articles) {
    try {
      const result = await generateAiAnalysisForArticle(article);
      if (result) updated++;
    } catch (error) {
      failed++;
      errors.push(`${article.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { selected: articles.length, updated, failed, errors };
}
