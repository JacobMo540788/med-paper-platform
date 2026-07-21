import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { toCardDTO } from "./articles";
import {
  GUIDELINE_WINDOW_YEARS,
  RESOURCE_KIND,
  RESEARCH_MIN_JIF,
  ROLLING_WINDOW_YEARS,
  UROLOGY_SPECIALTY,
  type ResourceKind,
} from "./constants";
import type { ArticleCardDTO } from "./types";

export type ResourceSort = "date_desc" | "date_asc" | "jif_desc" | "first_author_asc";

export interface ResourceSearchParams {
  resourceKind?: ResourceKind | "ALL";
  q?: string;
  diseaseArea?: string[];
  year?: number[];
  venue?: string[];
  studyType?: string;
  minJif?: number;
  liuBenRole?: string;
  sort?: ResourceSort;
  page?: number;
  limit?: number;
  includeAllYears?: boolean;
}

export function rollingWindowStart(referenceDate = new Date(), years = ROLLING_WINDOW_YEARS) {
  const d = new Date(referenceDate);
  d.setFullYear(d.getFullYear() - years);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isWithinRollingYears(date: Date, referenceDate = new Date(), years = ROLLING_WINDOW_YEARS) {
  return date >= rollingWindowStart(referenceDate, years) && date <= referenceDate;
}

export function isVerifiedJifEligible(
  impactFactor: number | null | undefined,
  jifStatus: string | null | undefined,
  threshold = RESEARCH_MIN_JIF
) {
  return jifStatus === "VERIFIED" && typeof impactFactor === "number" && impactFactor >= threshold;
}

export function authorSortKey(author?: string | null) {
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

export function dedupeKey(input: { doi?: string | null; pmid?: string | null; titleEn: string; year?: number | null }) {
  if (input.doi) return `doi:${input.doi.trim().toLowerCase()}`;
  if (input.pmid) return `pmid:${input.pmid.trim()}`;
  return `title:${input.titleEn.trim().toLowerCase().replace(/\s+/g, " ")}:${input.year ?? ""}`;
}

function splitParam(values?: string | string[] | null) {
  if (!values) return undefined;
  const raw = Array.isArray(values) ? values.join(",") : values;
  const parts = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export function parseResourceSearchParams(sp: URLSearchParams): ResourceSearchParams {
  return {
    resourceKind: (sp.get("resourceKind") as ResourceKind | "ALL") || undefined,
    q: sp.get("q") ?? undefined,
    diseaseArea: splitParam(sp.get("diseaseArea")),
    year: splitParam(sp.get("year"))?.map((y) => parseInt(y, 10)).filter(Number.isFinite),
    venue: splitParam(sp.get("venue")),
    studyType: sp.get("studyType") ?? undefined,
    minJif: sp.get("minJif") ? parseFloat(sp.get("minJif")!) : undefined,
    liuBenRole: sp.get("liuBenRole") ?? undefined,
    sort: (sp.get("sort") as ResourceSort) || undefined,
    page: sp.get("page") ? parseInt(sp.get("page")!, 10) : 1,
    limit: sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 20,
    includeAllYears: sp.get("includeAllYears") === "1",
  };
}

function baseWhere(params: ResourceSearchParams): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = {
    specialty: UROLOGY_SPECIALTY,
    verificationStatus: "VERIFIED",
  };

  if (params.resourceKind && params.resourceKind !== "ALL") {
    where.resourceKind = params.resourceKind;
  }

  const kind = params.resourceKind;
  const needsFiveYears =
    !params.includeAllYears &&
    (kind === RESOURCE_KIND.GUIDELINE ||
      kind === RESOURCE_KIND.CLINICAL_RESEARCH ||
      kind === RESOURCE_KIND.BASIC_RESEARCH ||
      !kind ||
      kind === "ALL");

  if (needsFiveYears) {
    const years = kind === RESOURCE_KIND.GUIDELINE ? GUIDELINE_WINDOW_YEARS : ROLLING_WINDOW_YEARS;
    where.publishDate = { gte: rollingWindowStart(new Date(), years) };
  }

  if (kind === RESOURCE_KIND.CLINICAL_RESEARCH || kind === RESOURCE_KIND.BASIC_RESEARCH) {
    where.impactFactor = { gte: params.minJif ?? RESEARCH_MIN_JIF };
    where.jifStatus = "VERIFIED";
  } else if (params.minJif != null) {
    where.impactFactor = { gte: params.minJif };
    where.jifStatus = "VERIFIED";
  }

  if (params.diseaseArea?.length) where.diseaseArea = { in: params.diseaseArea };
  if (params.year?.length) where.year = { in: params.year };
  if (params.studyType) where.studyType = params.studyType as "BASIC" | "CLINICAL";
  if (params.liuBenRole) where.liuBenRole = params.liuBenRole;

  if (params.venue?.length) {
    where.OR = params.venue.flatMap((v) => [
      { journal: { equals: v, mode: "insensitive" } },
      { organizationShortName: { equals: v, mode: "insensitive" } },
      { organization: { equals: v, mode: "insensitive" } },
    ]);
  }

  if (params.q?.trim()) {
    const q = params.q.trim();
    const qWhere: Prisma.ArticleWhereInput[] = [
      { titleEn: { contains: q, mode: "insensitive" } },
      { titleCn: { contains: q, mode: "insensitive" } },
      { abstract: { contains: q, mode: "insensitive" } },
      { abstractCn: { contains: q, mode: "insensitive" } },
      { keywords: { has: q } },
      { journal: { contains: q, mode: "insensitive" } },
      { organization: { contains: q, mode: "insensitive" } },
      { diseaseArea: { contains: q, mode: "insensitive" } },
    ];
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: qWhere }];
  }

  return where;
}

function compareNullableText(a?: string | null, b?: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "zh-Hans-CN");
}

export function compareResourceCards(a: ArticleCardDTO, b: ArticleCardDTO, sort: ResourceSort) {
  if (sort === "date_asc") {
    const diff = Date.parse(a.publishDate) - Date.parse(b.publishDate);
    if (diff !== 0) return diff;
  } else if (sort === "jif_desc") {
    const aHas = a.jifStatus === "VERIFIED" && typeof a.impactFactor === "number";
    const bHas = b.jifStatus === "VERIFIED" && typeof b.impactFactor === "number";
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.impactFactor !== b.impactFactor) return b.impactFactor - a.impactFactor;
  } else if (sort === "first_author_asc") {
    const diff = compareNullableText(authorSortKey(a.firstAuthor), authorSortKey(b.firstAuthor));
    if (diff !== 0) return diff;
  } else {
    const diff = Date.parse(b.publishDate) - Date.parse(a.publishDate);
    if (diff !== 0) return diff;
  }

  const dateTie = Date.parse(b.publishDate) - Date.parse(a.publishDate);
  if (dateTie !== 0) return dateTie;
  return a.titleEn.localeCompare(b.titleEn);
}

export async function searchUrologyResources(params: ResourceSearchParams) {
  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const sort = params.sort ?? "date_desc";
  const where = baseWhere(params);

  const rows = await prisma.article.findMany({
    where,
    orderBy: [{ publishDate: "desc" }, { titleEn: "asc" }],
    take: 500,
  });

  const cards = rows.map(toCardDTO).sort((a, b) => compareResourceCards(a, b, sort));
  const start = (page - 1) * limit;
  return {
    items: cards.slice(start, start + limit),
    total: cards.length,
    page,
    limit,
    totalPages: Math.ceil(cards.length / limit),
  };
}

export async function getUrologyOverview() {
  const fiveYearStart = rollingWindowStart();
  const [guidelines, clinical, basic, lab, latest] = await Promise.all([
    prisma.article.count({
      where: {
        specialty: UROLOGY_SPECIALTY,
        resourceKind: RESOURCE_KIND.GUIDELINE,
        verificationStatus: "VERIFIED",
        publishDate: { gte: fiveYearStart },
      },
    }),
    prisma.article.count({
      where: {
        specialty: UROLOGY_SPECIALTY,
        resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
        verificationStatus: "VERIFIED",
        publishDate: { gte: fiveYearStart },
        impactFactor: { gte: RESEARCH_MIN_JIF },
        jifStatus: "VERIFIED",
      },
    }),
    prisma.article.count({
      where: {
        specialty: UROLOGY_SPECIALTY,
        resourceKind: RESOURCE_KIND.BASIC_RESEARCH,
        verificationStatus: "VERIFIED",
        publishDate: { gte: fiveYearStart },
        impactFactor: { gte: RESEARCH_MIN_JIF },
        jifStatus: "VERIFIED",
      },
    }),
    prisma.article.count({
      where: {
        specialty: UROLOGY_SPECIALTY,
        resourceKind: RESOURCE_KIND.LIU_BEN_LAB,
        verificationStatus: "VERIFIED",
        publishDate: { gte: fiveYearStart },
      },
    }),
    prisma.article.findFirst({
      where: { specialty: UROLOGY_SPECIALTY, verificationStatus: "VERIFIED" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    fiveYearStart,
    counts: { guidelines, clinical, basic, lab },
    latestUpdate: latest?.updatedAt ?? null,
  };
}

export async function getResourceFacets(kind?: ResourceKind | "ALL") {
  const where = baseWhere({ resourceKind: kind, includeAllYears: kind === RESOURCE_KIND.LIU_BEN_LAB });
  const rows = await prisma.article.findMany({
    where,
    select: {
      diseaseArea: true,
      year: true,
      journal: true,
      organizationShortName: true,
      organization: true,
      studyType: true,
      liuBenRole: true,
    },
    take: 1000,
  });

  const diseaseAreas = [...new Set(rows.map((r) => r.diseaseArea).filter(Boolean) as string[])].sort();
  const years = [...new Set(rows.map((r) => r.year).filter((y): y is number => typeof y === "number"))].sort(
    (a, b) => b - a
  );
  const venues = [
    ...new Set(
      rows
        .map((r) => r.organizationShortName ?? r.organization ?? r.journal)
        .filter(Boolean) as string[]
    ),
  ].sort();
  const studyTypes = [...new Set(rows.map((r) => r.studyType).filter(Boolean) as string[])].sort();
  const liuBenRoles = [...new Set(rows.map((r) => r.liuBenRole).filter(Boolean) as string[])].sort();

  return { diseaseAreas, years, venues, studyTypes, liuBenRoles };
}
