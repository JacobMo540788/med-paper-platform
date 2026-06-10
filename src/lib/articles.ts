import type { Prisma, Specialty, StudyType } from "@prisma/client";
import { prisma } from "./db";
import { cacheGet, cacheSet } from "./redis";
import { getBeijingDateKey } from "./beijing-time";
import { CACHE_KEYS, CACHE_TTL, todayPicksCacheKey } from "./constants";
import { getTodayPicks } from "./pipeline/daily-fetch";
import type { ArticleCardDTO } from "./types";

export function toCardDTO(a: {
  id: string;
  titleEn: string;
  titleCn: string | null;
  specialty: Specialty;
  studyType: StudyType;
  impactFactor: number;
  journal: string;
  publishDate: Date;
  keywords: string[];
  aiSummary: string | null;
  articleType?: string | null;
  recommendSource?: string | null;
  recommendationReason?: string | null;
  recommendationScore?: number | null;
}): ArticleCardDTO {
  return {
    id: a.id,
    titleEn: a.titleEn,
    titleCn: a.titleCn,
    specialty: a.specialty,
    studyType: a.studyType,
    impactFactor: a.impactFactor,
    journal: a.journal,
    publishDate: a.publishDate.toISOString(),
    keywords: a.keywords,
    aiSummary: a.aiSummary,
    articleType: a.articleType ?? null,
    recommendSource: a.recommendSource ?? null,
    recommendationReason: a.recommendationReason ?? null,
    recommendationScore: a.recommendationScore ?? null,
  };
}

export async function fetchTodayCards(): Promise<ArticleCardDTO[]> {
  const dateKey = getBeijingDateKey();
  const cacheKey = todayPicksCacheKey(dateKey);
  const cached = await cacheGet<ArticleCardDTO[]>(cacheKey);
  if (cached) return cached;

  const articles = await getTodayPicks();
  const cards = articles.map(toCardDTO);
  await cacheSet(cacheKey, cards, CACHE_TTL);
  return cards;
}

export interface SearchParams {
  q?: string;
  specialty?: Specialty;
  studyType?: StudyType;
  minIf?: number;
  page?: number;
  limit?: number;
}

export async function searchArticles(params: SearchParams) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 50);
  const skip = (page - 1) * limit;

  const where: Prisma.ArticleWhereInput = { verificationStatus: "VERIFIED" };

  if (params.specialty) where.specialty = params.specialty;
  if (params.studyType) where.studyType = params.studyType;
  if (params.minIf) where.impactFactor = { gte: params.minIf };

  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { titleEn: { contains: q, mode: "insensitive" } },
      { titleCn: { contains: q, mode: "insensitive" } },
      { abstract: { contains: q, mode: "insensitive" } },
      { keywords: { has: q } },
      { journal: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
      skip,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return {
    items: items.map(toCardDTO),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getArticleById(id: string) {
  const cacheKey = CACHE_KEYS.article(id);
  const cached = await cacheGet<Awaited<ReturnType<typeof prisma.article.findUnique>>>(cacheKey);
  if (cached) return cached;

  const article = await prisma.article.findUnique({ where: { id } });
  if (article) await cacheSet(cacheKey, article, CACHE_TTL);
  return article;
}

export async function getRelatedArticles(
  id: string,
  specialty: Specialty,
  limit = 5
) {
  return prisma.article.findMany({
    where: { specialty, id: { not: id }, verificationStatus: "VERIFIED" },
    orderBy: { impactFactor: "desc" },
    take: limit,
  });
}
