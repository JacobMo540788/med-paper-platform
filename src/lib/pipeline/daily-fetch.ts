import type { Specialty } from "@prisma/client";
import { getBeijingDateKey } from "../beijing-time";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { cacheDel } from "../redis";
import {
  BASIC_STUDY_TERMS,
  CLINICAL_STUDY_TERMS,
  PIPELINE_STATUS,
  RESOURCE_KIND,
  UROLOGY_QUERY_GROUPS,
  UROLOGY_SPECIALTY,
} from "../constants";
import { classifyStudyType } from "../classifier";
import { fetchPubMedPaged } from "../fetchers/pubmed";
import { enrichFromCrossref, parseCrossrefAuthors, parseCrossrefDate, stripCrossrefMarkup } from "../fetchers/crossref";
import { resolveJournalImpactFactor } from "../journal-if";
import type { RawPaper } from "../types";
import { upsertArticleRecord } from "./article-upsert";
import { selectDailyRecommendation } from "./recommendation";
import { finishHarvestRun, getIncrementalWindow, startHarvestRun, weeklyRunKey, withJobLock } from "./harvest-run";

const ALL_SPECIALTIES: Specialty[] = [UROLOGY_SPECIALTY];

type Funnel = {
  totalHits: number;
  discovered: number;
  dedupedCandidates: number;
  metadataVerified: number;
  contentReviewed: number;
  jifVerified: number;
  published: number;
  manualReview: number;
  rejected: number;
  sourceErrors: number;
  failed: number;
};

type CandidatePaper = RawPaper & {
  diseaseArea?: string;
  resourceKind?: string;
};

function emptyFunnel(): Funnel {
  return {
    totalHits: 0,
    discovered: 0,
    dedupedCandidates: 0,
    metadataVerified: 0,
    contentReviewed: 0,
    jifVerified: 0,
    published: 0,
    manualReview: 0,
    rejected: 0,
    sourceErrors: 0,
    failed: 0,
  };
}

function dedupePapers<T extends RawPaper>(papers: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of papers) {
    const key =
      p.doi?.trim().toLowerCase() ??
      p.pmid?.trim() ??
      `${p.titleEn.toLowerCase().replace(/\s+/g, " ")}:${p.authors[0] ?? ""}:${p.publishDate.getFullYear()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function enrichPaper<T extends RawPaper>(paper: T): Promise<T> {
  if (!paper.doi) return paper;
  try {
    const cr = await enrichFromCrossref(paper.doi);
    return {
      ...paper,
      abstract: paper.abstract ?? stripCrossrefMarkup(cr.abstract) ?? paper.abstract,
      authors: paper.authors.length ? paper.authors : parseCrossrefAuthors(cr.author),
      publishDate: parseCrossrefDate(cr.published) ?? paper.publishDate,
      journal: cr["container-title"]?.[0] ?? paper.journal,
    } as T;
  } catch (e) {
    console.error(`[crossref-enrich] ${paper.doi} failed:`, e);
    return paper;
  }
}

function dateFilter(fromDate: Date, toDate: Date) {
  const from = fromDate.toISOString().slice(0, 10).replaceAll("-", "/");
  const to = toDate.toISOString().slice(0, 10).replaceAll("-", "/");
  return `("${from}"[PDAT] : "${to}"[PDAT])`;
}

function termsAny(terms: string[], field = "Title/Abstract") {
  return terms.map((term) => `"${term}"[${field}]`).join(" OR ");
}

function buildCandidateQueries(fromDate: Date, toDate: Date) {
  const window = dateFilter(fromDate, toDate);
  return UROLOGY_QUERY_GROUPS.flatMap((group) => {
    const disease = [
      ...group.mesh.map((m) => `"${m}"[MeSH Terms]`),
      ...group.keywords.map((k) => `"${k}"[Title/Abstract]`),
      ...(group.abbreviations ?? []).map((k) => `"${k}"[Title/Abstract]`),
    ].join(" OR ");
    return [
      {
        diseaseArea: group.diseaseArea,
        resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
        term: `(${disease}) AND (${termsAny(CLINICAL_STUDY_TERMS)}) AND ${window} AND english[Language] NOT (Case Reports[Publication Type] OR Editorial[Publication Type] OR Letter[Publication Type] OR News[Publication Type])`,
      },
      {
        diseaseArea: group.diseaseArea,
        resourceKind: RESOURCE_KIND.BASIC_RESEARCH,
        term: `(${disease}) AND (${termsAny(BASIC_STUDY_TERMS)}) AND ${window} AND english[Language] NOT (Editorial[Publication Type] OR Letter[Publication Type] OR News[Publication Type])`,
      },
    ];
  });
}

export async function archiveCurrentTodayPicks(): Promise<number> {
  const result = await prisma.article.updateMany({
    where: { isTodayPick: true, verificationStatus: "VERIFIED", pipelineStatus: PIPELINE_STATUS.PUBLISHED },
    data: {
      isTodayPick: false,
      isInHistory: true,
      archivedAt: new Date(),
    },
  });
  return result.count;
}

async function fetchAndStoreForSpecialty(
  specialty: Specialty,
  fromDate: Date,
  toDate: Date
): Promise<Funnel & { byQuery: Array<{ diseaseArea: string; resourceKind: string; totalHits: number; requested: number }> }> {
  const funnel = emptyFunnel();
  const byQuery: Array<{ diseaseArea: string; resourceKind: string; totalHits: number; requested: number }> = [];
  const candidates: CandidatePaper[] = [];

  for (const query of buildCandidateQueries(fromDate, toDate)) {
    const result = await fetchPubMedPaged(query.term, specialty, {
      retMax: 80,
      maxRecords: 240,
      sort: "date",
    });
    funnel.totalHits += result.totalHits;
    byQuery.push({
      diseaseArea: query.diseaseArea,
      resourceKind: query.resourceKind,
      totalHits: result.totalHits,
      requested: result.requested,
    });
    candidates.push(...result.papers.map((paper) => ({ ...paper, diseaseArea: query.diseaseArea, resourceKind: query.resourceKind })));
  }

  funnel.discovered = candidates.length;
  const merged = dedupePapers(candidates).filter((p) => p.doi || p.pmid) as CandidatePaper[];
  funnel.dedupedCandidates = merged.length;

  for (const raw of merged) {
    try {
      const paper = await enrichPaper(raw);
      const jif = await resolveJournalImpactFactor(paper.journal);
      const studyType = classifyStudyType(paper);
      const articleId = await upsertArticleRecord(paper, jif.impactFactor ?? 0, studyType, {
        asHistory: true,
        asCoreLibrary: jif.status === "VERIFIED" && (jif.impactFactor ?? 0) >= 10,
        resourceKind: raw.resourceKind === RESOURCE_KIND.BASIC_RESEARCH ? RESOURCE_KIND.BASIC_RESEARCH : RESOURCE_KIND.CLINICAL_RESEARCH,
        diseaseArea: raw.diseaseArea,
        runLlm: true,
        jifStatus: jif.status,
        jifYear: jif.jifYear ?? null,
        jifSource: jif.source ?? null,
        sourceRecordId: paper.pmid ?? paper.doi ?? null,
        rawMetadata: {
          provider: paper.sourceProvider ?? "pubmed",
          pmid: paper.pmid,
          doi: paper.doi,
          titleEn: paper.titleEn,
          journal: paper.journal,
          articleType: paper.articleType,
          diseaseArea: raw.diseaseArea,
          resourceKind: raw.resourceKind,
          jif,
        },
      });
      if (!articleId) {
        funnel.sourceErrors++;
        continue;
      }
      funnel.metadataVerified++;
      if (process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY) funnel.contentReviewed++;
      if (jif.status === "VERIFIED") funnel.jifVerified++;
      const saved = await prisma.article.findUnique({
        where: { id: articleId },
        select: { pipelineStatus: true },
      });
      if (saved?.pipelineStatus === PIPELINE_STATUS.PUBLISHED) funnel.published++;
      else if (saved?.pipelineStatus === PIPELINE_STATUS.REJECTED) funnel.rejected++;
      else funnel.manualReview++;
    } catch (error) {
      funnel.failed++;
      console.error("[weekly-harvest] candidate failed:", error);
    }
  }

  return { ...funnel, byQuery };
}

export async function runDailyFetchPipeline(): Promise<{
  totalFetched: number;
  totalAccepted: number;
  totalFallback: number;
  totalFailed: number;
  archived: number;
  beijingDateKey: string;
  durationMs: number;
  skipped?: boolean;
  recommendation?: {
    articleId: string;
    recommendSource: string;
    reason: string;
    score: number;
  } | null;
}> {
  const start = Date.now();
  const todayKey = getBeijingDateKey();
  const window = await getIncrementalWindow(new Date());
  const runKey = weeklyRunKey(new Date());

  const locked = await withJobLock("urology-weekly-harvest", 55 * 60_000, async () => {
    await startHarvestRun({ runKey, mode: "weekly", fromDate: window.fromDate, toDate: window.toDate });
    const archived = await archiveCurrentTodayPicks();
    const errors: string[] = [];
    const totals = emptyFunnel();
    const queryReports: Prisma.InputJsonValue[] = [];

    for (const specialty of ALL_SPECIALTIES) {
      const t0 = Date.now();
      try {
        const result = await fetchAndStoreForSpecialty(specialty, window.fromDate, window.toDate);
        for (const key of Object.keys(totals) as Array<keyof Funnel>) totals[key] += result[key];
        queryReports.push(...result.byQuery);
        await prisma.fetchLog.create({
          data: {
            specialty,
            fetched: result.dedupedCandidates,
            accepted: result.published,
            fallback: 0,
            errors: result.failed ? `${result.failed} candidates failed during weekly harvest.` : null,
            durationMs: Date.now() - t0,
          },
        });
      } catch (e) {
        errors.push(`${specialty}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const recommendation = await selectDailyRecommendation();
    const totalFallback = recommendation?.recommendSource === "daily_new" ? 0 : recommendation ? 1 : 0;
    await cacheDel("cache:*");

    await finishHarvestRun(runKey, errors.length ? "FAILED" : "SUCCESS", {
      ...totals,
      report: {
        fromDate: window.fromDate.toISOString(),
        toDate: window.toDate.toISOString(),
        queries: queryReports,
      },
      errors,
    });

    return {
      totalFetched: totals.dedupedCandidates,
      totalAccepted: totals.published,
      totalFallback,
      totalFailed: totals.failed + totals.sourceErrors,
      archived,
      beijingDateKey: todayKey,
      durationMs: Date.now() - start,
      recommendation: recommendation
        ? {
            articleId: recommendation.article.id,
            recommendSource: recommendation.recommendSource,
            reason: recommendation.reason,
            score: recommendation.score,
          }
        : null,
    };
  });

  if ("skipped" in locked) {
    return {
      totalFetched: 0,
      totalAccepted: 0,
      totalFallback: 0,
      totalFailed: 0,
      archived: 0,
      beijingDateKey: todayKey,
      durationMs: Date.now() - start,
      skipped: true,
      recommendation: null,
    };
  }

  return locked;
}

export async function getTodayPicks() {
  const todayKey = getBeijingDateKey();
  const rec = await prisma.dailyRecommendation.findUnique({
    where: { dateKey: todayKey },
    include: { article: true },
  });

  if (rec?.article?.verificationStatus === "VERIFIED" && rec.article.pipelineStatus === PIPELINE_STATUS.PUBLISHED) {
    return [
      {
        ...rec.article,
        recommendSource: rec.recommendSource,
        recommendationReason: rec.reason,
        recommendationScore: rec.score,
      },
    ];
  }

  const fallback = await prisma.article.findFirst({
    where: {
      isTodayPick: true,
      featuredDateKey: todayKey,
      verificationStatus: "VERIFIED",
      pipelineStatus: PIPELINE_STATUS.PUBLISHED,
    },
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
  });
  return fallback ? [fallback] : [];
}
