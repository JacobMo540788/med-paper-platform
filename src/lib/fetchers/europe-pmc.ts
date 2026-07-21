import type { Specialty } from "@prisma/client";
import type { RawPaper } from "../types";
import { SPECIALTY_CONFIG } from "../constants";
import { sleep } from "../utils";

interface EuropePmcResult {
  nextCursorMark?: string;
  hitCount?: number;
  resultList?: {
    result?: EuropePmcHit[];
  };
}

interface EuropePmcHit {
  title?: string;
  abstractText?: string;
  journalTitle?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  authorString?: string;
  firstPublicationDate?: string;
  firstIndexDate?: string;
  keywordList?: { keyword?: string[] };
  pubTypeList?: { pubType?: string[] };
}

export interface EuropePmcCursorOptions {
  pageSize?: number;
  maxPages?: number;
  cursorMark?: string;
  signal?: AbortSignal;
}

export interface EuropePmcCursorResult {
  papers: RawPaper[];
  totalHits: number;
  nextCursorMark?: string;
  query: string;
}

async function fetchEuropePmcJson(url: string, signal?: AbortSignal): Promise<EuropePmcResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (res.ok) return (await res.json()) as EuropePmcResult;
      if (![429, 500, 502, 503, 504].includes(res.status)) return {};
      lastError = new Error(`Europe PMC ${res.status}: ${await res.text()}`);
    } catch (error) {
      lastError = error;
    }
    await sleep((attempt + 1) * 750);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchEuropePmcCursor(
  query: string,
  specialty: Specialty,
  options: EuropePmcCursorOptions = {}
): Promise<EuropePmcCursorResult> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const maxPages = Math.min(Math.max(options.maxPages ?? 3, 1), 40);
  let cursorMark = options.cursorMark ?? "*";
  let totalHits = 0;
  const papers: RawPaper[] = [];

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "core",
      pageSize: String(pageSize),
      cursorMark,
      sort: "P_DATE desc",
    });
    const data = await fetchEuropePmcJson(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`,
      options.signal
    );
    totalHits = Number(data.hitCount ?? totalHits);
    const hits = data.resultList?.result ?? [];
    papers.push(...hits.map((h) => toPaper(h, specialty)).filter((paper): paper is RawPaper => paper !== null));

    const next = data.nextCursorMark;
    if (!next || next === cursorMark || hits.length === 0) break;
    cursorMark = next;
    await sleep(350);
  }

  return { papers, totalHits, nextCursorMark: cursorMark, query };
}

export async function fetchEuropePmcRecent(specialty: Specialty, maxResults = 30): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const query = `${cfg.pubmedQuery} AND FIRST_PDATE:[${formatDate(start)} TO ${formatDate(end)}]`;
  const result = await fetchEuropePmcCursor(query, specialty, {
    pageSize: Math.min(maxResults, 100),
    maxPages: Math.ceil(maxResults / Math.min(maxResults, 100)),
  });
  return result.papers.slice(0, maxResults);
}

function toPaper(h: EuropePmcHit, specialty: Specialty): RawPaper | null {
  const dateRaw = h.firstPublicationDate ?? h.firstIndexDate;
  if (!dateRaw || (!h.pmid && !h.doi) || !h.title || h.title.length < 5) return null;
  return {
    titleEn: h.title,
    abstract: h.abstractText,
    journal: h.journalTitle ?? "Unknown",
    doi: h.doi,
    pmid: h.pmid,
    authors: h.authorString?.split(", ").filter(Boolean) ?? [],
    publishDate: new Date(dateRaw),
    keywords: h.keywordList?.keyword ?? [],
    articleType: h.pubTypeList?.pubType?.join("; "),
    externalUrl: h.pmid
      ? `https://europepmc.org/article/MED/${h.pmid}`
      : h.doi
        ? `https://doi.org/${h.doi}`
        : undefined,
    sourceProvider: "europepmc",
    specialty,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
