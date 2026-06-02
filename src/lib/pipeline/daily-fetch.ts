import type { Specialty } from "@prisma/client";
import { getBeijingDateKey } from "../beijing-time";
import { prisma } from "../db";
import { cacheDel } from "../redis";
import { CACHE_KEYS, SPECIALTY_CONFIG } from "../constants";
import { classifyStudyType } from "../classifier";
import { fetchPubMedRecent } from "../fetchers/pubmed";
import { fetchEuropePmcRecent } from "../fetchers/europe-pmc";
import { enrichFromCrossref, parseCrossrefAuthors, parseCrossrefDate } from "../fetchers/crossref";
import { passesIfFilter, resolveImpactFactor } from "../journal-if";
import type { RawPaper } from "../types";
import { upsertArticleRecord } from "./article-upsert";

const ALL_SPECIALTIES = Object.keys(SPECIALTY_CONFIG) as Specialty[];

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
  } catch {
    return paper;
  }
}

/**
 * 将当前首页推荐归档至各专业历史文献库。
 */
export async function archiveCurrentTodayPicks(): Promise<number> {
  const result = await prisma.article.updateMany({
    where: { isTodayPick: true },
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
): Promise<{ fetched: number; accepted: number; fallback: number }> {
  const pubmed = await fetchPubMedRecent(specialty);
  const epmc = await fetchEuropePmcRecent(specialty);
  const merged = dedupePapers([...pubmed, ...epmc]);

  let accepted = 0;

  for (const raw of merged) {
    const paper = await enrichPaper(raw);
    const ifVal = await resolveImpactFactor(paper.journal);
    if (!passesIfFilter(ifVal)) continue;

    const studyType = classifyStudyType(paper);
    await upsertArticleRecord(paper, ifVal, studyType, {
      asTodayPick: true,
      featuredDateKey: todayKey,
      runLlm: true,
    });
    accepted++;
  }

  let fallback = 0;
  if (accepted === 0) {
    fallback = await applyFallbackClassics(specialty, todayKey);
  }

  return { fetched: merged.length, accepted, fallback };
}

/** 当日无新高 IF 论文时，从历史库/核心库回退精选 */
async function applyFallbackClassics(specialty: Specialty, todayKey: string): Promise<number> {
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const classics = await prisma.article.findMany({
    where: {
      specialty,
      impactFactor: { gt: 15 },
      publishDate: { gte: tenYearsAgo },
      OR: [{ isInHistory: true }, { isCoreLibrary: true }, { isLandmark: true }],
    },
    orderBy: [{ isLandmark: "desc" }, { impactFactor: "desc" }],
    take: 5,
  });

  if (classics.length === 0) return 0;

  await prisma.article.updateMany({
    where: { id: { in: classics.map((c) => c.id) } },
    data: {
      isTodayPick: true,
      featuredDateKey: todayKey,
      isInHistory: false,
    },
  });

  return classics.length;
}

export async function runDailyFetchPipeline(): Promise<{
  totalFetched: number;
  totalAccepted: number;
  totalFallback: number;
  archived: number;
  beijingDateKey: string;
  durationMs: number;
}> {
  const start = Date.now();
  const todayKey = getBeijingDateKey();
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalFallback = 0;
  const errors: string[] = [];

  const archived = await archiveCurrentTodayPicks();

  for (const specialty of ALL_SPECIALTIES) {
    const t0 = Date.now();
    try {
      const r = await fetchAndStoreForSpecialty(specialty, todayKey);
      totalFetched += r.fetched;
      totalAccepted += r.accepted;
      totalFallback += r.fallback;

      await prisma.fetchLog.create({
        data: {
          specialty,
          fetched: r.fetched,
          accepted: r.accepted,
          fallback: r.fallback,
          durationMs: Date.now() - t0,
        },
      });
    } catch (e) {
      errors.push(`${specialty}: ${e instanceof Error ? e.message : String(e)}`);
    }
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
    archived,
    beijingDateKey: todayKey,
    durationMs,
  };
}

/** 首页：仅当日（北京时间）推荐 */
export async function getTodayPicks() {
  const todayKey = getBeijingDateKey();
  return prisma.article.findMany({
    where: {
      isTodayPick: true,
      featuredDateKey: todayKey,
    },
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
    take: 30,
  });
}
