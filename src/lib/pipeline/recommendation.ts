import type { Article, Prisma, Specialty } from "@prisma/client";
import { getBeijingDateKey } from "../beijing-time";
import { CORE_LIBRARY_YEARS, CORE_MIN_IMPACT_FACTOR, MIN_IMPACT_FACTOR, SPECIALTY_CONFIG } from "../constants";
import { prisma } from "../db";
import { cacheDel } from "../redis";
import { generateAiAnalysisForArticle } from "./ai-analysis";

export type RecommendSource = "daily_new" | "historical" | "core";

const ALL_SPECIALTIES = Object.keys(SPECIALTY_CONFIG) as Specialty[];

function beijingDateRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function yearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function prioritySpecialty(date = new Date()): Specialty | null {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(date);
  const map: Record<string, Specialty | null> = {
    Mon: "ONCOLOGY_COLORECTAL",
    Tue: "OPHTHALMOLOGY",
    Wed: "GASTROENTEROLOGY",
    Thu: "UROLOGY",
    Fri: "NEPHROLOGY",
    Sat: null,
    Sun: null,
  };
  return map[weekday] ?? null;
}

function journalPriority(journal: string) {
  const j = journal.toLowerCase();
  if (/(new england|nejm|lancet|nature|science|cell|jama|bmj)/.test(j)) return 20;
  if (/(gut|gastroenterology|european urology|kidney international)/.test(j)) return 10;
  return 0;
}

function aiCompleteness(article: Article) {
  return article.aiAnalysisJson && article.aiSummary && article.titleCn ? 5 : 0;
}

function scoreArticle(article: Article, source: RecommendSource) {
  const ageDays = Math.max(0, (Date.now() - article.publishDate.getTime()) / (24 * 60 * 60 * 1000));
  const recencyScore = Math.max(0, 15 - ageDays / 90);
  const sourceBonus = source === "daily_new" ? 30 : source === "historical" ? 10 : 5;
  const neverRecommended = article.recommendCount === 0 ? 15 : 0;
  return article.impactFactor * 0.45 + journalPriority(article.journal) + recencyScore + neverRecommended + aiCompleteness(article) + sourceBonus;
}

async function pickBest(where: Prisma.ArticleWhereInput, source: RecommendSource, preferredSpecialty: Specialty | null) {
  const preferredWhere = preferredSpecialty ? { ...where, specialty: preferredSpecialty } : where;
  const preferred = await prisma.article.findMany({
    where: preferredWhere,
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
    take: 20,
  });
  const pool = preferred.length
    ? preferred
    : await prisma.article.findMany({
        where,
        orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
        take: 20,
      });
  if (!pool.length) return null;
  return pool
    .map((article) => ({ article, score: scoreArticle(article, source) }))
    .sort((a, b) => b.score - a.score)[0];
}

async function writeRecommendation(params: {
  article: Article;
  score: number;
  source: RecommendSource;
  dateKey: string;
  reason: string;
}) {
  const { start } = beijingDateRange(params.dateKey);

  await prisma.article.updateMany({
    where: { isTodayPick: true },
    data: { isTodayPick: false },
  });

  const article = await prisma.article.update({
    where: { id: params.article.id },
    data: {
      isTodayPick: true,
      featuredDateKey: params.dateKey,
      recommendSource: params.source,
      lastRecommendedAt: new Date(),
      recommendCount: { increment: 1 },
      isInHistory: true,
    },
  });

  await prisma.dailyRecommendation.upsert({
    where: { dateKey: params.dateKey },
    create: {
      dateKey: params.dateKey,
      recommendationDate: start,
      articleId: article.id,
      specialty: article.specialty,
      recommendSource: params.source,
      reason: params.reason,
      score: params.score,
    },
    update: {
      articleId: article.id,
      specialty: article.specialty,
      recommendSource: params.source,
      reason: params.reason,
      score: params.score,
    },
  });

  await cacheDel("cache:*");
  return { article, recommendSource: params.source, reason: params.reason, score: params.score };
}

export async function selectDailyRecommendation(date = new Date()) {
  const dateKey = getBeijingDateKey(date);
  const existing = await prisma.dailyRecommendation.findUnique({
    where: { dateKey },
    include: { article: true },
  });
  if (existing?.article) {
    return {
      article: existing.article,
      recommendSource: existing.recommendSource as RecommendSource,
      reason: existing.reason ?? "",
      score: existing.score ?? 0,
    };
  }

  const preferredSpecialty = prioritySpecialty(date);
  const { start } = beijingDateRange(dateKey);
  const recentLimit = daysAgo(90);
  const coreRecentLimit = daysAgo(180);
  const dailyCandidateStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);

  const base: Prisma.ArticleWhereInput = {
    verificationStatus: "VERIFIED",
    impactFactor: { gt: MIN_IMPACT_FACTOR },
    AND: [{ OR: [{ lastRecommendedAt: null }, { lastRecommendedAt: { lt: recentLimit } }] }],
  };

  const daily = await pickBest(
    {
      ...base,
      AND: [
        ...(Array.isArray(base.AND) ? base.AND : []),
        {
          OR: [
            { createdAt: { gte: dailyCandidateStart } },
            { updatedAt: { gte: dailyCandidateStart } },
            { publishDate: { gte: dailyCandidateStart } },
          ],
        },
      ],
    },
    "daily_new",
    preferredSpecialty
  );
  if (daily) {
    await generateAiAnalysisForArticle(daily.article, { timeoutMs: 25_000 }).catch(() => null);
    return writeRecommendation({
      article: daily.article,
      score: daily.score,
      source: "daily_new",
      dateKey,
      reason: "过去 24 小时内抓取或发表的高影响因子文献，优先匹配今日轮换学科。",
    });
  }

  const historical = await pickBest(
    {
      ...base,
      isInHistory: true,
      publishDate: { gte: yearsAgo(10) },
    },
    "historical",
    preferredSpecialty
  );
  if (historical) {
    await generateAiAnalysisForArticle(historical.article, { timeoutMs: 25_000 }).catch(() => null);
    return writeRecommendation({
      article: historical.article,
      score: historical.score,
      source: "historical",
      dateKey,
      reason: "今日无合格新文献，选取近 10 年历史高分文献作为备用推荐。",
    });
  }

  const core = await pickBest(
    {
      verificationStatus: "VERIFIED",
      isCoreLibrary: true,
      impactFactor: { gte: CORE_MIN_IMPACT_FACTOR },
      publishDate: { gte: yearsAgo(CORE_LIBRARY_YEARS) },
      OR: [{ lastRecommendedAt: null }, { lastRecommendedAt: { lt: coreRecentLimit } }],
    },
    "core",
    preferredSpecialty
  );
  if (core) {
    await generateAiAnalysisForArticle(core.article, { timeoutMs: 25_000 }).catch(() => null);
    return writeRecommendation({
      article: core.article,
      score: core.score,
      source: "core",
      dateKey,
      reason: "今日无合格新文献和历史候选，选取核心文献库文章进行重读。",
    });
  }

  return null;
}

export async function getTodayRecommendation() {
  const dateKey = getBeijingDateKey();
  return prisma.dailyRecommendation.findUnique({
    where: { dateKey },
    include: { article: true },
  });
}

export async function listRecommendationHistory(page = 1, limit = 20) {
  const take = Math.min(Math.max(limit, 1), 50);
  const skip = (Math.max(page, 1) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.dailyRecommendation.findMany({
      include: { article: true },
      orderBy: { recommendationDate: "desc" },
      skip,
      take,
    }),
    prisma.dailyRecommendation.count(),
  ]);
  return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
}
