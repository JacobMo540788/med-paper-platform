import { createHash } from "node:crypto";
import { prisma } from "../db";
import { classifyStudyType } from "../classifier";
import { runFullLlmPipeline } from "../llm/analyzer";
import { decodeHtmlEntities } from "../html";
import type { RawPaper } from "../types";
import { mergeVerifiedData, verifyArticle } from "../validation/article-verifier";
import { PIPELINE_STATUS, RESOURCE_KIND, type ResourceKind } from "../constants";
import { decidePipelineStatus } from "./urology-rules";

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
  liuBenRole?: string | null;
  sourceRecordId?: string | null;
  rawMetadata?: unknown;
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
    console.error(`[article-verification] rejected: ${paper.titleEn} :: ${verification.error}`);
    await markExistingArticleFailed(paper, verification.error ?? "Article verification failed.");
    return null;
  }

  const verifiedPaper = mergeVerifiedData(paper, verification.verifiedData, verification.sourceUrl);
  const cleanAbstract = verifiedPaper.abstract ? decodeHtmlEntities(verifiedPaper.abstract) : null;
  const cleanTitle = decodeHtmlEntities(verifiedPaper.titleEn);
  const firstAuthor = verifiedPaper.authors[0] ?? null;
  const resourceKind = options.resourceKind ?? RESOURCE_KIND.CLINICAL_RESEARCH;
  const effectiveJifStatus =
    options.jifStatus ??
    (resourceKind === RESOURCE_KIND.GUIDELINE && impactFactor <= 0
      ? "NOT_APPLICABLE"
      : impactFactor > 0
        ? "VERIFIED"
        : "PENDING");

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
    Boolean(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY) &&
    !existing?.aiAnalysisJson;

  let titleCn: string | null = existing?.titleCn ?? null;
  let abstractCn: string | null = existing?.abstractCn ?? null;
  let aiSummary: string | null = existing?.aiSummary ?? null;
  let aiAnalysisJson: object | null = (existing?.aiAnalysisJson as object) ?? null;
  let keywordsBilingual: object | null = (existing?.keywordsBilingual as object) ?? null;

  if (shouldRunLlm && cleanAbstract) {
    try {
      const llm = await runFullLlmPipeline({
        titleEn: cleanTitle,
        abstract: cleanAbstract,
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
      console.error("LLM pipeline failed:", e instanceof Error ? e.message : e);
    }
  }

  const now = new Date();
  const decisionPaper: RawPaper = {
    ...verifiedPaper,
    titleEn: cleanTitle,
    abstract: cleanAbstract ?? undefined,
  };
  const decision = decidePipelineStatus({
    paper: decisionPaper,
    resourceKind,
    impactFactor,
    jifStatus: effectiveJifStatus,
    metadataVerified: true,
  });

  const sourceRecordId = options.sourceRecordId ?? verifiedPaper.pmid ?? verifiedPaper.doi ?? null;
  const rawMetadataHash = hashMetadata(
    options.rawMetadata ?? {
      titleEn: paper.titleEn,
      doi: paper.doi,
      pmid: paper.pmid,
      journal: paper.journal,
      sourceProvider: paper.sourceProvider,
    }
  );

  const canPublish = decision.canPublish;
  const data = {
    titleEn: cleanTitle,
    titleCn,
    abstract: cleanAbstract,
    abstractCn,
    journal: verifiedPaper.journal,
    impactFactor,
    jifStatus: effectiveJifStatus,
    jifYear: effectiveJifStatus === "VERIFIED" ? options.jifYear ?? 2024 : options.jifYear ?? null,
    jifSource: effectiveJifStatus === "VERIFIED" ? options.jifSource ?? "local JCR whitelist" : options.jifSource ?? null,
    jifVerifiedAt: effectiveJifStatus === "VERIFIED" ? now : null,
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
    liuBenRole: options.liuBenRole ?? null,
    dataSource: verification.verifiedData.sourceProvider,
    dataVerifiedAt: now,
    keywords: verifiedPaper.keywords,
    keywordsBilingual: keywordsBilingual ?? undefined,
    articleType: verifiedPaper.articleType ?? null,
    aiSummary,
    aiAnalysisJson: aiAnalysisJson ?? undefined,
    source: verifiedPaper.sourceProvider === "europepmc" ? ("EUROPE_PMC" as const) : ("PUBMED" as const),
    sourceProvider: verification.verifiedData.sourceProvider,
    sourceUrl: verification.sourceUrl ?? verifiedPaper.externalUrl ?? null,
    verificationStatus: "VERIFIED" as const,
    verificationError: null,
    lastVerifiedAt: now,
    pipelineStatus: decision.status,
    rawSource: verification.verifiedData.sourceProvider,
    rawSourceUrl: verification.sourceUrl ?? verifiedPaper.externalUrl ?? null,
    sourceRecordId,
    fetchedAt: now,
    rawMetadataHash,
    validationTrail: {
      metadata: { status: PIPELINE_STATUS.METADATA_VERIFIED, source: verification.verifiedData.sourceProvider },
      content: { status: canPublish ? PIPELINE_STATUS.CONTENT_REVIEWED : PIPELINE_STATUS.MANUAL_REVIEW },
      jif: { status: effectiveJifStatus, impactFactor, jifYear: options.jifYear ?? null, source: options.jifSource ?? null },
      pipeline: { status: decision.status, exclusionReasons: decision.exclusionReasons },
    },
    exclusionReasons: decision.exclusionReasons,
    aiModel: process.env.DEEPSEEK_MODEL ?? process.env.LLM_MODEL ?? null,
    aiPromptVersion: aiAnalysisJson ? "content-summary-v1" : null,
    contentReviewedAt: now,
    publishedAt: canPublish ? now : null,
    externalUrl: verification.sourceUrl ?? verifiedPaper.externalUrl ?? null,
    ...(options.asTodayPick
      ? {
          isTodayPick: canPublish,
          featuredDateKey: options.featuredDateKey ?? null,
          isInHistory: false,
        }
      : {}),
    ...(options.asCoreLibrary
      ? {
          isCoreLibrary: canPublish,
          coreAddedAt: canPublish ? now : null,
        }
      : {}),
    ...(options.asHistory ? { isInHistory: canPublish } : {}),
  };

  if (existing) {
    await prisma.article.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.article.create({
    data: {
      ...data,
      isTodayPick: canPublish ? options.asTodayPick ?? false : false,
      featuredDateKey: options.featuredDateKey ?? null,
      isCoreLibrary: canPublish ? options.asCoreLibrary ?? false : false,
      isInHistory: canPublish ? options.asHistory ?? false : false,
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
      pipelineStatus: PIPELINE_STATUS.SOURCE_ERROR,
      exclusionReasons: ["metadata_not_verified"],
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
  if (/infertility|erectile|andrology|sexual dysfunction/.test(text)) return "男科、男性不育与性功能障碍";
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

function hashMetadata(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
