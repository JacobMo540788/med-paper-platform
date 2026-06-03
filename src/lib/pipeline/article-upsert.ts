import type { StudyType } from "@prisma/client";
import { prisma } from "../db";
import { classifyStudyType } from "../classifier";
import { runFullLlmPipeline } from "../llm/analyzer";
import type { RawPaper } from "../types";
import { mergeVerifiedData, verifyArticle } from "../validation/article-verifier";

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
  const verification = await verifyArticle({
    titleEn: paper.titleEn,
    journal: paper.journal,
    doi: paper.doi,
    pmid: paper.pmid,
    publishDate: paper.publishDate,
    abstract: paper.abstract,
    sourceProvider: paper.sourceProvider,
  });

  if (!verification.ok || !verification.verifiedData) {
    console.error(
      `[article-verification] rejected: ${paper.titleEn} :: ${verification.error}`
    );
    await markExistingArticleFailed(paper, verification.error ?? "Article verification failed.");
    return null;
  }

  const verifiedPaper = mergeVerifiedData(paper, verification.verifiedData, verification.sourceUrl);

  const existing = await prisma.article.findFirst({
    where: {
      OR: [
        verifiedPaper.doi ? { doi: verifiedPaper.doi } : {},
        verifiedPaper.pmid ? { pmid: verifiedPaper.pmid } : {},
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
        titleEn: verifiedPaper.titleEn,
        abstract: verifiedPaper.abstract ?? "",
        specialty: verifiedPaper.specialty,
        studyType,
        journal: verifiedPaper.journal,
      });
      titleCn = llm.titleCn;
      abstractCn = llm.abstractCn;
      aiSummary = llm.aiSummary;
      aiAnalysisJson = llm.aiAnalysis;
      keywordsBilingual = llm.aiAnalysis.keywords_cn_en;
    } catch (e) {
      console.error("LLM pipeline failed:", e);
    }
  }

  const data = {
    titleEn: verifiedPaper.titleEn,
    titleCn,
    abstract: verifiedPaper.abstract ?? null,
    abstractCn,
    journal: verifiedPaper.journal,
    impactFactor,
    doi: verifiedPaper.doi ?? null,
    pmid: verifiedPaper.pmid ?? null,
    authors: verifiedPaper.authors,
    publishDate: verifiedPaper.publishDate,
    specialty: verifiedPaper.specialty,
    studyType,
    keywords: verifiedPaper.keywords,
    keywordsBilingual: keywordsBilingual ?? undefined,
    articleType: verifiedPaper.articleType ?? null,
    aiSummary,
    aiAnalysisJson: aiAnalysisJson ?? undefined,
    source: verifiedPaper.sourceProvider === "europepmc" ? "EUROPE_PMC" as const : "PUBMED" as const,
    sourceProvider: verification.verifiedData.sourceProvider,
    sourceUrl: verification.sourceUrl ?? verifiedPaper.externalUrl ?? null,
    verificationStatus: "VERIFIED" as const,
    verificationError: null,
    lastVerifiedAt: new Date(),
    externalUrl: verification.sourceUrl ?? verifiedPaper.externalUrl ?? null,
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

async function markExistingArticleFailed(paper: RawPaper, error: string) {
  const selectors = [
    paper.doi ? { doi: paper.doi } : null,
    paper.pmid ? { pmid: paper.pmid } : null,
  ].filter(Boolean) as { doi?: string; pmid?: string }[];

  if (!selectors.length) return;

  await prisma.article.updateMany({
    where: { OR: selectors },
    data: {
      verificationStatus: "FAILED",
      verificationError: error,
      isTodayPick: false,
      isInHistory: false,
      isCoreLibrary: false,
    },
  });
}
