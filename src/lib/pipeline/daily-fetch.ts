import type { Specialty } from "@prisma/client";
import { getBeijingDateKey } from "../beijing-time";
import { prisma } from "../db";
import { cacheDel } from "../redis";
import { SPECIALTY_CONFIG } from "../constants";
import { classifyStudyType } from "../classifier";
import { fetchPubMedRecent } from "../fetchers/pubmed";
import { fetchEuropePmcRecent } from "../fetchers/europe-pmc";
import { enrichFromCrossref, parseCrossrefAuthors, parseCrossrefDate } from "../fetchers/crossref";
import { passesIfFilter, resolveImpactFactor } from "../journal-if";
import type { RawPaper } from "../types";
import { upsertArticleRecord } from "./article-upsert";

const ALL_SPECIALTIES = Object.keys(SPECIALTY_CONFIG) as Specialty[];
const ONCOLOGY_REVIEW_FALLBACK_SPECIALTY: Specialty = "ONCOLOGY_COLORECTAL";

function dedupePapers(papers: RawPaper[]): RawPaper[] {
  const seen = new Set<string>();
  const out: RawPaper[] = [];
  for (const p of papers) {
    const key = p.doi ?? p.pmid ?? p.titleEn.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function enrichPaper(paper: RawPaper): Promise<RawPaper> {
  if (!paper.doi) return paper;
  try {
    const cr = await enrichFromCrossref(paper.doi);
    return {
      ...paper,
      abstract: paper.abstract ?? cr.abstract?.replace(/<[^>]+>/g, "") ?? paper.abstract,
      authors: paper.authors.length ? paper.authors : parseCrossrefAuthors(cr.author),
      publishDate: parseCrossrefDate(cr.published) ?? paper.publishDate,
      journal: cr["container-title"]?.[0] ?? paper.journal,
    };
  } catch (e) {
    console.error(`[crossref-enrich] ${paper.doi} failed:`, e);
    return paper;
  }
}

export async function archiveCurrentTodayPicks(): Promise<number> {
  const result = await prisma.article.updateMany({
    where: { isTodayPick: true, verificationStatus: "VERIFIED" },
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
  todayKey: string
): Promise<{ fetched: number; accepted: number; failed: number }> {
  const pubmed = await fetchPubMedRecent(specialty);
  const epmc = await fetchEuropePmcRecent(specialty);
  const merged = dedupePapers([...pubmed, ...epmc]).filter((p) => p.doi || p.pmid);

  let accepted = 0;
  let failed = 0;

  for (const raw of merged) {
    const paper = await enrichPaper(raw);
    const ifVal = await resolveImpactFactor(paper.journal);
    if (!passesIfFilter(ifVal)) continue;

    const studyType = classifyStudyType(paper);
    const articleId = await upsertArticleRecord(paper, ifVal, studyType, {
      asTodayPick: true,
      featuredDateKey: todayKey,
      runLlm: true,
    });

    if (articleId) accepted++;
    else failed++;
  }

  return { fetched: merged.length, accepted, failed };
}

async function promoteOncologyReviewFallback(todayKey: string): Promise<number> {
  const article = await prisma.article.findFirst({
    where: {
      specialty: ONCOLOGY_REVIEW_FALLBACK_SPECIALTY,
      isCoreLibrary: true,
      verificationStatus: "VERIFIED",
      featuredDateKey: null,
    },
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
  });

  if (!article) return 0;

  await prisma.article.update({
    where: { id: article.id },
    data: {
      isTodayPick: true,
      featuredDateKey: todayKey,
    },
  });

  return 1;
}

export async function runDailyFetchPipeline(): Promise<{
  totalFetched: number;
  totalAccepted: number;
  totalFallback: number;
  totalFailed: number;
  archived: number;
  beijingDateKey: string;
  durationMs: number;
}> {
  const start = Date.now();
  const todayKey = getBeijingDateKey();
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalFallback = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  const archived = await archiveCurrentTodayPicks();

  for (const specialty of ALL_SPECIALTIES) {
    const t0 = Date.now();
    try {
      const r = await fetchAndStoreForSpecialty(specialty, todayKey);
      totalFetched += r.fetched;
      totalAccepted += r.accepted;
      totalFailed += r.failed;

      await prisma.fetchLog.create({
        data: {
          specialty,
          fetched: r.fetched,
          accepted: r.accepted,
          fallback: 0,
          errors: r.failed ? `${r.failed} candidate articles failed authenticity verification.` : null,
          durationMs: Date.now() - t0,
        },
      });
    } catch (e) {
      errors.push(`${specialty}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (totalAccepted === 0) {
    totalFallback = await promoteOncologyReviewFallback(todayKey);
    if (totalFallback) totalAccepted += totalFallback;

    await prisma.fetchLog.create({
      data: {
        specialty: ONCOLOGY_REVIEW_FALLBACK_SPECIALTY,
        fetched: 0,
        accepted: totalFallback,
        fallback: totalFallback,
        errors: totalFallback
          ? "No eligible daily articles found. Promoted one verified oncology core review as today's homepage pick."
          : "No eligible daily articles found and no unused verified oncology core review was available.",
        durationMs: 0,
      },
    });
  }

  await cacheDel("cache:*");

  const durationMs = Date.now() - start;
  if (errors.length) {
    await prisma.fetchLog.create({
      data: {
        fetched: totalFetched,
        accepted: totalAccepted,
        fallback: totalFallback,
        durationMs,
        errors: errors.join("\n"),
      },
    });
  }

  return {
    totalFetched,
    totalAccepted,
    totalFallback,
    totalFailed,
    archived,
    beijingDateKey: todayKey,
    durationMs,
  };
}

export async function getTodayPicks() {
  const todayKey = getBeijingDateKey();
  return prisma.article.findMany({
    where: {
      isTodayPick: true,
      featuredDateKey: todayKey,
      verificationStatus: "VERIFIED",
    },
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
    take: 30,
  });
}
