import { prisma } from "../db";
import { classifyStudyType } from "../classifier";
import { runFullLlmPipeline } from "../llm/analyzer";
import { decodeHtmlEntities } from "../html";
import type { RawPaper } from "../types";
import { mergeVerifiedData, verifyArticle } from "../validation/article-verifier";
import { RESOURCE_KIND, type ResourceKind } from "../constants";

export interface UpsertArticleOptions {
  asTodayPick?: boolean;
  featuredDateKey?: string;
  asCoreLibrary?: boolean;
  asHistory?: boolean;
  runLlm?: boolean;
  resourceKind?: ResourceKind;
  diseaseArea?: string | null;
  organization?: string | null;
  organizationShortName?: string | null;
  officialUrl?: string | null;
  guidelineType?: string | null;
  versionYear?: number | null;
  jifStatus?: string;
  jifYear?: number | null;
  jifSource?: string | null;
  inclusionEvidence?: string | null;
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
  const cleanAbstract = verifiedPaper.abstract ? decodeHtmlEntities(verifiedPaper.abstract) : null;
  const cleanTitle = decodeHtmlEntities(verifiedPaper.titleEn);
  const firstAuthor = verifiedPaper.authors[0] ?? null;
  const resourceKind = options.resourceKind ?? RESOURCE_KIND.CLINICAL_RESEARCH;

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
        titleEn: cleanTitle,
        abstract: cleanAbstract ?? "",
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
    titleEn: cleanTitle,
    titleCn,
    abstract: cleanAbstract,
    abstractCn,
    journal: verifiedPaper.journal,
    impactFactor,
    jifStatus: options.jifStatus ?? "VERIFIED",
    jifYear: options.jifYear ?? 2024,
    jifSource: options.jifSource ?? "local JCR whitelist",
    jifVerifiedAt: new Date(),
    doi: verifiedPaper.doi ?? null,
    pmid: verifiedPaper.pmid ?? null,
    authors: verifiedPaper.authors,
    firstAuthor,
    authorSortKey: authorSortKey(firstAuthor),
    publishDate: verifiedPaper.publishDate,
    year: verifiedPaper.publishDate.getFullYear(),
    specialty: verifiedPaper.specialty,
    studyType,
    resourceKind,
    diseaseArea: options.diseaseArea ?? inferUrologyDiseaseArea(cleanTitle, cleanAbstract),
    organization: options.organization ?? null,
    organizationShortName: options.organizationShortName ?? null,
    officialUrl: options.officialUrl ?? null,
    guidelineType: options.guidelineType ?? null,
    versionYear: options.versionYear ?? null,
    inclusionEvidence: options.inclusionEvidence ?? null,
    dataSource: verification.verifiedData.sourceProvider,
    dataVerifiedAt: new Date(),
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
    paper.pmid ? { pmid: String(paper.pmid) } : null,
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

function inferUrologyDiseaseArea(title: string, abstract?: string | null) {
  const text = `${title} ${abstract ?? ""}`.toLowerCase();
  if (/urinary tract infection|cystitis|pyelonephritis|\buti\b/.test(text)) return "尿路感染";
  if (/pediatric|paediatric|children|child|adolescent/.test(text)) return "儿童泌尿";
  if (/urolithiasis|urinary stone|kidney stone|ureteral stone|nephrolithiasis/.test(text)) return "泌尿系结石";
  if (/incontinence|female urology|overactive bladder|pelvic floor/.test(text)) return "尿失禁与女性泌尿";
  if (/neuro-urology|neurogenic/.test(text)) return "神经泌尿";
  if (/infertility|erectile|andrology|sexual dysfunction/.test(text)) {
    return "男科、男性不育与性功能障碍";
  }
  if (/trauma|reconstruction|urethral stricture|urethroplasty/.test(text)) return "泌尿系统创伤与重建";
  if (/benign prostatic hyperplasia|lower urinary tract symptoms|\bluts\b/.test(text)) {
    return "良性前列腺增生与男性下尿路症状";
  }
  if (/upper tract urothelial/.test(text)) return "上尿路尿路上皮癌";
  if (/testicular|penile/.test(text)) return "睾丸癌及阴茎癌";
  if (/prostate cancer|psma|castration-resistant/.test(text)) return "前列腺癌";
  if (/bladder cancer|urothelial carcinoma/.test(text)) return "膀胱癌";
  if (/renal cell|kidney cancer|renal cancer/.test(text)) return "肾癌";
  if (/transplant/.test(text)) return "肾移植及其他泌尿外科相关疾病";
  return "肾移植及其他泌尿外科相关疾病";
}
function authorSortKey(author?: string | null) {
  if (!author?.trim()) return null;
  const normalized = author
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const parts = normalized.split(/\s+/);
  return parts.length > 1 ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}` : normalized;
}
