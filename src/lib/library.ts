import type { Prisma, Specialty, StudyType } from "@prisma/client";
import { prisma } from "./db";
import { toCardDTO } from "./articles";
import type { ArticleCardDTO } from "./types";

export type LibraryType = "history" | "core";
export type LibrarySort = "publishDate" | "impactFactor" | "archivedAt";

export interface LibrarySearchParams {
  specialty: Specialty;
  libraryType: LibraryType;
  q?: string;
  studyType?: StudyType;
  minIf?: number;
  maxIf?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: LibrarySort;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function searchSpecialtyLibrary(params: LibrarySearchParams) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 50);
  const skip = (page - 1) * limit;
  const order = params.order ?? "desc";

  const where: Prisma.ArticleWhereInput = {
    specialty: params.specialty,
    verificationStatus: "VERIFIED",
    ...(params.libraryType === "history"
      ? { isInHistory: true }
      : { isCoreLibrary: true }),
  };

  if (params.studyType) where.studyType = params.studyType;
  if (params.minIf != null || params.maxIf != null) {
    where.impactFactor = {};
    if (params.minIf != null) where.impactFactor.gte = params.minIf;
    if (params.maxIf != null) where.impactFactor.lte = params.maxIf;
  }

  if (params.dateFrom || params.dateTo) {
    where.publishDate = {};
    if (params.dateFrom) where.publishDate.gte = new Date(params.dateFrom);
    if (params.dateTo) {
      const end = new Date(params.dateTo);
      end.setHours(23, 59, 59, 999);
      where.publishDate.lte = end;
    }
  }

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

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] = [];
  if (params.sort === "impactFactor") {
    orderBy.push({ impactFactor: order });
  } else if (params.sort === "archivedAt" && params.libraryType === "history") {
    orderBy.push({ archivedAt: order });
  } else {
    orderBy.push({ publishDate: order });
  }
  orderBy.push({ impactFactor: "desc" });

  const [items, total] = await Promise.all([
    prisma.article.findMany({ where, orderBy, skip, take: limit }),
    prisma.article.count({ where }),
  ]);

  return {
    items: items.map(toCardDTO) as ArticleCardDTO[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function countLibraryArticles(specialty: Specialty) {
  const [history, core] = await Promise.all([
    prisma.article.count({ where: { specialty, isInHistory: true, verificationStatus: "VERIFIED" } }),
    prisma.article.count({ where: { specialty, isCoreLibrary: true, verificationStatus: "VERIFIED" } }),
  ]);
  return { history, core };
}
