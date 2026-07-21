import { XMLParser } from "fast-xml-parser";
import type { Specialty } from "@prisma/client";
import type { RawPaper } from "../types";
import { SPECIALTY_CONFIG } from "../constants";
import { sleep } from "../utils";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const DEFAULT_BATCH_SIZE = 80;

export interface PubMedPageOptions {
  retMax?: number;
  maxRecords?: number;
  retStart?: number;
  sort?: "relevance" | "date" | "pub+date";
  signal?: AbortSignal;
}

export interface PubMedPagedResult {
  papers: RawPaper[];
  totalHits: number;
  requested: number;
  query: string;
}

function ncbiParams() {
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    tool: "medfrontier",
    email: process.env.NCBI_EMAIL ?? "support@example.com",
  });
  if (process.env.NCBI_API_KEY) params.set("api_key", process.env.NCBI_API_KEY);
  return params;
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (![429, 500, 502, 503, 504].includes(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (error) {
      lastError = error;
    }
    await sleep((i + 1) * 750);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`PubMed API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchXml(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`PubMed XML error: ${res.status}`);
  return parser.parse(await res.text());
}

async function politeDelay() {
  await sleep(process.env.NCBI_API_KEY ? 120 : 350);
}

export async function fetchPubMedPaged(
  term: string,
  specialty: Specialty,
  options: PubMedPageOptions = {}
): Promise<PubMedPagedResult> {
  const retMax = Math.min(Math.max(options.retMax ?? DEFAULT_BATCH_SIZE, 1), 200);
  const maxRecords = Math.min(Math.max(options.maxRecords ?? retMax, 1), 5000);
  const startAt = Math.max(options.retStart ?? 0, 0);
  const sort = options.sort ?? "relevance";
  const allIds: string[] = [];
  let totalHits = 0;
  let retStart = startAt;

  while (allIds.length < maxRecords) {
    const params = ncbiParams();
    params.set("retmax", String(Math.min(retMax, maxRecords - allIds.length)));
    params.set("retstart", String(retStart));
    params.set("sort", sort);
    params.set("term", term);

    const search = await fetchJson<{ esearchresult?: { count?: string; idlist?: string[] } }>(
      `${BASE}/esearch.fcgi?${params.toString()}`,
      { signal: options.signal }
    );
    totalHits = Number(search.esearchresult?.count ?? 0);
    const ids = search.esearchresult?.idlist ?? [];
    if (ids.length === 0) break;
    allIds.push(...ids);
    retStart += ids.length;
    if (retStart >= totalHits) break;
    await politeDelay();
  }

  const papers: RawPaper[] = [];
  for (let i = 0; i < allIds.length; i += DEFAULT_BATCH_SIZE) {
    const chunk = allIds.slice(i, i + DEFAULT_BATCH_SIZE);
    await politeDelay();
    papers.push(...(await fetchPubMedDetails(chunk, specialty, options.signal)));
  }

  return { papers, totalHits, requested: allIds.length, query: term };
}

export async function fetchPubMedRecent(specialty: Specialty, maxResults = 40): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const term = `(${cfg.pubmedQuery}) AND ("last 7 days"[PDat]) AND (english[Language])`;
  const result = await fetchPubMedPaged(term, specialty, {
    retMax: Math.min(maxResults, 100),
    maxRecords: maxResults,
    sort: "date",
  });
  return result.papers;
}

const TOP_JOURNAL_QUERY =
  '(Nature[Journal] OR Science[Journal] OR Cell[Journal] OR "N Engl J Med"[Journal] OR Lancet[Journal] OR JAMA[Journal] OR BMJ[Journal] OR "Nature Medicine"[Journal] OR "Nature Biotechnology"[Journal] OR "Nature Genetics"[Journal] OR "Nature Communications"[Journal] OR "Science Translational Medicine"[Journal] OR "Cancer Cell"[Journal] OR "Cell Metabolism"[Journal])';

export async function fetchPubMedCoreLibrary(specialty: Specialty, maxResults = 80): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const start = new Date();
  start.setFullYear(start.getFullYear() - 5);
  const dateFilter = `("${start.toISOString().slice(0, 10).replaceAll("-", "/")}"[PDAT] : "3000"[PDAT])`;
  const term = `(${cfg.pubmedQuery}) AND ${TOP_JOURNAL_QUERY} AND ${dateFilter} AND (english[Language])`;
  const result = await fetchPubMedPaged(term, specialty, {
    retMax: Math.min(maxResults, 100),
    maxRecords: maxResults,
    sort: "relevance",
  });
  return result.papers;
}

export async function fetchPubMedReviewLibrary(
  specialty: Specialty,
  years = 10,
  maxResults = 160,
  retStart = 0
): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  const dateFilter = `("${start.toISOString().slice(0, 10).replaceAll("-", "/")}"[PDAT] : "3000"[PDAT])`;
  const reviewFilter = '(Review[Publication Type] OR systematic review[Title/Abstract] OR meta-analysis[Publication Type])';
  const term = `(${cfg.pubmedQuery}) AND ${reviewFilter} AND ${dateFilter} AND (english[Language])`;
  const result = await fetchPubMedPaged(term, specialty, {
    retMax: Math.min(maxResults, 100),
    maxRecords: maxResults,
    retStart,
    sort: "relevance",
  });
  return result.papers;
}

export async function fetchPubMedSearch(
  term: string,
  specialty: Specialty,
  maxResults = 80,
  retStart = 0,
  sort: "relevance" | "date" = "relevance"
): Promise<RawPaper[]> {
  const result = await fetchPubMedPaged(term, specialty, {
    retMax: Math.min(maxResults, 100),
    maxRecords: maxResults,
    retStart,
    sort,
  });
  return result.papers;
}

export async function fetchPubMedDetails(
  ids: string[],
  specialty: Specialty,
  signal?: AbortSignal
): Promise<RawPaper[]> {
  if (ids.length === 0) return [];
  const params = ncbiParams();
  params.delete("retmode");
  params.set("retmode", "xml");
  params.set("id", ids.join(","));
  const xml = (await fetchXml(`${BASE}/efetch.fcgi?${params.toString()}`, { signal })) as {
    PubmedArticleSet?: { PubmedArticle?: PubmedArticle | PubmedArticle[] };
  };

  const articles = xml.PubmedArticleSet?.PubmedArticle;
  if (!articles) return [];
  const list = Array.isArray(articles) ? articles : [articles];
  return list.map((a) => parsePubmedArticle(a, specialty)).filter(Boolean) as RawPaper[];
}

interface PubmedArticle {
  MedlineCitation?: {
    PMID?: { "#text"?: string } | string;
    Article?: {
      ArticleTitle?: string | { "#text"?: string };
      Abstract?: { AbstractText?: string | string[] | { "#text"?: string }[] };
      AuthorList?: { Author?: Author | Author[] };
      Journal?: { Title?: string; ISSN?: string; JournalIssue?: { PubDate?: PubmedDate } };
      ArticleDate?: PubmedDate | PubmedDate[];
      PublicationTypeList?: { PublicationType?: string | { "#text"?: string }[] };
    };
    MeshHeadingList?: { MeshHeading?: MeshHeading | MeshHeading[] };
    DateCompleted?: PubmedDate;
  };
  PubmedData?: {
    ArticleIdList?: { ArticleId?: ArticleId | ArticleId[] };
  };
}

interface Author {
  LastName?: string;
  ForeName?: string;
  CollectiveName?: string;
}

interface MeshHeading {
  DescriptorName?: string | { "#text"?: string };
}

interface ArticleId {
  "@_IdType"?: string;
  "#text"?: string;
}

interface PubmedDate {
  Year?: string | number;
  Month?: string | number;
  Day?: string | number;
  MedlineDate?: string;
}

function parsePubmedArticle(article: PubmedArticle, specialty: Specialty): RawPaper | null {
  const med = article.MedlineCitation;
  const art = med?.Article;
  if (!art) return null;

  const titleRaw = art.ArticleTitle;
  const titleEn = typeof titleRaw === "string" ? titleRaw : titleRaw?.["#text"] ?? "";
  if (!titleEn) return null;

  const journal = art.Journal?.Title ?? "Unknown Journal";
  const pmidRaw = med?.PMID;
  const pmid = typeof pmidRaw === "string" ? pmidRaw : String(pmidRaw?.["#text"] ?? "");

  let doi: string | undefined;
  const ids = article.PubmedData?.ArticleIdList?.ArticleId;
  const idList = Array.isArray(ids) ? ids : ids ? [ids] : [];
  for (const id of idList) {
    if (id["@_IdType"] === "doi") doi = id["#text"]?.trim();
  }

  const abstract = parseAbstract(art.Abstract?.AbstractText);
  const authors = parseAuthors(art.AuthorList?.Author);
  const keywords = parseMesh(med?.MeshHeadingList?.MeshHeading);
  const articleDates = art.ArticleDate;
  const articleDate = Array.isArray(articleDates) ? articleDates[0] : articleDates;
  const publishDate =
    parsePubmedDate(articleDate) ??
    parsePubmedDate(art.Journal?.JournalIssue?.PubDate) ??
    parsePubmedDate(med?.DateCompleted);
  if (!publishDate) return null;

  const pubTypes = art.PublicationTypeList?.PublicationType;
  const typeList = Array.isArray(pubTypes) ? pubTypes : pubTypes ? [pubTypes] : [];
  const articleType = typeList
    .map((t) => (typeof t === "string" ? t : t["#text"]))
    .filter(Boolean)
    .join("; ");

  return {
    titleEn,
    abstract,
    journal,
    doi,
    pmid: pmid || undefined,
    authors,
    publishDate,
    keywords,
    articleType: articleType || undefined,
    externalUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : doi ? `https://doi.org/${doi}` : undefined,
    sourceProvider: "pubmed",
    specialty,
  };
}

function parseAbstract(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((x) => (typeof x === "string" ? x : x["#text"] ?? "")).filter(Boolean).join("\n");
  }
  return (raw as { "#text"?: string })["#text"];
}

function parseAuthors(raw: Author | Author[] | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((a) => (a.CollectiveName ? a.CollectiveName : [a.ForeName, a.LastName].filter(Boolean).join(" ")))
    .filter(Boolean);
}

function parseMesh(raw: MeshHeading | MeshHeading[] | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((m) => {
      const d = m.DescriptorName;
      return typeof d === "string" ? d : d?.["#text"];
    })
    .filter((x): x is string => Boolean(x));
}

export function parsePubmedDate(d: PubmedDate | undefined): Date | null {
  const medline = d?.MedlineDate?.trim();
  const medlineYear = medline?.match(/\b(19|20)\d{2}\b/)?.[0];
  const rawYear = d?.Year ?? medlineYear;
  if (!rawYear) return null;

  const year = Number(rawYear);
  const rawMonth = String(d?.Month ?? "1").trim().toLowerCase().slice(0, 3);
  const monthNames: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const month = monthNames[rawMonth] ?? Number(rawMonth);
  const day = Number(d?.Day ?? 1);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}
