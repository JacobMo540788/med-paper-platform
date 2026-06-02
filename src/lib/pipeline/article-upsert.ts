import type { StudyType } from "@prisma/client";
import { prisma } from "../db";
import { classifyStudyType } from "../classifier";
import { runFullLlmPipeline } from "../llm/analyzer";
import type { RawPaper } from "../types";

export interface UpsertArticleOptions {
  asTodayPick?: boolean;
  featuredDateKey?: string;
  asCoreLibrary?: boolean;
  asHistory?: boolean;
  runLlm?: boolean;
}

export async function upsertArticleRecord(
  paper: RawPaper,
  impactFactor: number,
  studyType: ReturnType<typeof classifyStudyType>,
  options: UpsertArticleOptions = {}
): Promise<string | null> {
  const existing = await prisma.article.findFirst({
    where: {
      OR: [
        paper.doi ? { doi: paper.doi } : {},
        paper.pmid ? { pmid: paper.pmid } : {},
      ].filter((o) => Object.keys(o).length > 0),
    },
  });

  const shouldRunLlm =
    options.runLlm !== false &&
    !!process.env.LLM_API_KEY &&
    !existing?.aiAnalysisJson;

  let titleCn: string | null = existing?.titleCn ?? null;
  let abstractCn: string | null = existing?.abstractCn ?? null;
  let aiSummary: string | null = existing?.aiSummary ?? null;
  let aiAnalysisJson: object | null = (existing?.aiAnalysisJson as object) ?? null;
  let keywordsBilingual: object | null = (existing?.keywordsBilingual as object) ?? null;

  if (shouldRunLlm) {
    try {
      const llm = await runFullLlmPipeline({
        titleEn: paper.titleEn,
        abstract: paper.abstract ?? "",
        specialty: paper.specialty,
        studyType,
        journal: paper.journal,
      });
      titleCn = llm.titleCn;
      abstractCn = llm.abstractCn;
      aiSummary = llm.aiSummary;
      aiAnalysisJson = llm.aiAnalysis;
      keywordsBilingual = llm.aiAnalysis.keywords_cn_en;
    } catch (e) {
      console.error("LLM pipeline failed:", e);
      aiSummary = paper.titleEn.slice(0, 80);
    }
  }

  const data = {
    titleEn: paper.titleEn,
    titleCn,
    abstract: paper.abstract ?? null,
    abstractCn,
    journal: paper.journal,
    impactFactor,
    doi: paper.doi ?? null,
    pmid: paper.pmid ?? null,
    authors: paper.authors,
    publishDate: paper.publishDate,
    specialty: paper.specialty,
    studyType,
    keywords: paper.keywords,
    keywordsBilingual: keywordsBilingual ?? undefined,
    articleType: paper.articleType ?? null,
    aiSummary,
    aiAnalysisJson: aiAnalysisJson ?? undefined,
    externalUrl: paper.externalUrl ?? null,
    source: "PUBMED" as const,
    ...(options.asTodayPick
      ? {
          isTodayPick: true,
          featuredDateKey: options.featuredDateKey ?? null,
          isInHistory: false,
        }
      : {}),
    ...(options.asCoreLibrary
      ? {
          isCoreLibrary: true,
          coreAddedAt: new Date(),
        }
      : {}),
    ...(options.asHistory ? { isInHistory: true } : {}),
  };

  if (existing) {
    await prisma.article.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.article.create({
    data: {
      ...data,
      isTodayPick: options.asTodayPick ?? false,
      featuredDateKey: options.featuredDateKey ?? null,
      isCoreLibrary: options.asCoreLibrary ?? false,
      isInHistory: options.asHistory ?? false,
    },
  });
  return created.id;
}
