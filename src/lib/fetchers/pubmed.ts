import { XMLParser } from "fast-xml-parser";
import type { Specialty } from "@prisma/client";
import type { RawPaper } from "../types";
import { SPECIALTY_CONFIG } from "../constants";
import { sleep } from "../utils";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function apiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${key}` : "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`PubMed API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchXml(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed XML error: ${res.status}`);
  const text = await res.text();
  return parser.parse(text);
}

/**
 * 从 PubMed 抓取最近 24 小时论文（新手解释：PubMed 是美国医学文献数据库）。
 */
export async function fetchPubMedRecent(
  specialty: Specialty,
  maxResults = 40
): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const dateFilter = '("last 1 day"[PDat])';
  const term = `(${cfg.pubmedQuery}) AND ${dateFilter} AND (english[Language])`;

  const searchUrl =
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}` +
    `&sort=date&term=${encodeURIComponent(term)}${apiKeyParam()}`;

  const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl);
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  await sleep(350);
  return fetchPubMedDetails(ids, specialty);
}

const TOP_JOURNAL_QUERY =
  '(Nature[Journal] OR Science[Journal] OR Cell[Journal] OR "N Engl J Med"[Journal] OR Lancet[Journal] OR JAMA[Journal] OR BMJ[Journal] OR "Nature Medicine"[Journal] OR "Nature Biotechnology"[Journal] OR "Nature Genetics"[Journal] OR "Nature Communications"[Journal] OR "Science Translational Medicine"[Journal] OR "Cancer Cell"[Journal] OR "Cell Metabolism"[Journal])';

/**
 * 核心文献库：近15年顶刊论文检索（后续按 IF>60 过滤）。
 */
export async function fetchPubMedCoreLibrary(
  specialty: Specialty,
  maxResults = 80
): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const year = new Date().getFullYear() - 15;
  const dateFilter = `("${year}/01/01"[PDAT] : "3000"[PDAT])`;
  const term = `(${cfg.pubmedQuery}) AND ${TOP_JOURNAL_QUERY} AND ${dateFilter} AND (english[Language])`;

  const searchUrl =
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}` +
    `&sort=relevance&term=${encodeURIComponent(term)}${apiKeyParam()}`;

  const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl);
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  await sleep(350);
  return fetchPubMedDetails(ids, specialty);
}

export async function fetchPubMedReviewLibrary(
  specialty: Specialty,
  years = 10,
  maxResults = 160,
  retStart = 0
): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const startYear = new Date().getFullYear() - years;
  const dateFilter = `("${startYear}/01/01"[PDAT] : "3000"[PDAT])`;
  const reviewFilter = '(Review[Publication Type] OR systematic review[Title/Abstract] OR meta-analysis[Publication Type])';
  const term = `(${cfg.pubmedQuery}) AND ${reviewFilter} AND ${dateFilter} AND (english[Language])`;

  const searchUrl =
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}` +
    `&retstart=${retStart}` +
    `&sort=relevance&term=${encodeURIComponent(term)}${apiKeyParam()}`;

  const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl);
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  await sleep(350);
  return fetchPubMedDetails(ids, specialty);
}

async function fetchPubMedDetails(ids: string[], specialty: Specialty): Promise<RawPaper[]> {
  const fetchUrl =
    `${BASE}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}${apiKeyParam()}`;
  const xml = await fetchXml(fetchUrl) as {
    PubmedArticleSet?: { PubmedArticle?: PubmedArticle | PubmedArticle[] };
  };

  const articles = xml.PubmedArticleSet?.PubmedArticle;
  if (!articles) return [];
  const list = Array.isArray(articles) ? articles : [articles];

  return list.map((a) => parsePubmedArticle(a, specialty)).filter(Boolean) as RawPaper[];
}

interface PubmedArticle {
  MedlineCitation?: {
    PMID?: { "#text"?: string };
    Article?: {
      ArticleTitle?: string | { "#text"?: string };
      Abstract?: { AbstractText?: string | string[] | { "#text"?: string }[] };
      AuthorList?: { Author?: Author | Author[] };
      Journal?: { Title?: string; ISSN?: string };
      PublicationTypeList?: { PublicationType?: string | { "#text"?: string }[] };
    };
    MeshHeadingList?: { MeshHeading?: MeshHeading | MeshHeading[] };
    DateCompleted?: { Year?: string; Month?: string; Day?: string };
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

function parsePubmedArticle(article: PubmedArticle, specialty: Specialty): RawPaper | null {
  const med = article.MedlineCitation;
  const art = med?.Article;
  if (!art) return null;

  const titleRaw = art.ArticleTitle;
  const titleEn =
    typeof titleRaw === "string"
      ? titleRaw
      : (titleRaw as { "#text"?: string })?.["#text"] ?? "";
  if (!titleEn) return null;

  const journal = art.Journal?.Title ?? "Unknown Journal";
  const pmid = String(med?.PMID?.["#text"] ?? med?.PMID ?? "");

  let doi: string | undefined;
  const ids = article.PubmedData?.ArticleIdList?.ArticleId;
  const idList = Array.isArray(ids) ? ids : ids ? [ids] : [];
  for (const id of idList) {
    if (id["@_IdType"] === "doi") doi = id["#text"];
  }

  const abstract = parseAbstract(art.Abstract?.AbstractText);
  const authors = parseAuthors(art.AuthorList?.Author);
  const keywords = parseMesh(med?.MeshHeadingList?.MeshHeading);
  const publishDate = parseDate(med?.DateCompleted);
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
    externalUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
    sourceProvider: "pubmed",
    specialty,
  };
}

function parseAbstract(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x : (x as { "#text"?: string })["#text"] ?? ""))
      .join("\n");
  }
  return (raw as { "#text"?: string })["#text"];
}

function parseAuthors(raw: Author | Author[] | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((a) => {
    if (a.CollectiveName) return a.CollectiveName;
    return [a.ForeName, a.LastName].filter(Boolean).join(" ");
  });
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

function parseDate(
  d: { Year?: string; Month?: string; Day?: string } | undefined
): Date | null {
  if (!d?.Year) return null;
  const y = parseInt(d.Year, 10);
  const m = parseInt(d.Month ?? "1", 10) - 1;
  const day = parseInt(d.Day ?? "1", 10);
  return new Date(y, m, day);
}
