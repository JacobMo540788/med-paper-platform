import type { RawPaper } from "../types";
import { enrichFromCrossref, parseCrossrefAuthors, parseCrossrefDate } from "../fetchers/crossref";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export interface ArticleVerificationInput {
  titleEn: string;
  journal: string;
  doi?: string | null;
  pmid?: string | null;
  publishDate?: Date | null;
  abstract?: string | null;
  sourceProvider?: string | null;
}

export interface VerifiedArticleData {
  titleEn: string;
  journal: string;
  doi?: string;
  pmid?: string;
  publishDate: Date;
  abstract?: string;
  authors: string[];
  sourceProvider: string;
}

export interface ArticleVerificationResult {
  ok: boolean;
  verifiedData?: VerifiedArticleData;
  error?: string;
  sourceUrl?: string;
}

interface PubMedSummary {
  result?: Record<string, unknown> & {
    uids?: string[];
  };
}

interface PubMedDoc {
  title?: string;
  fulljournalname?: string;
  source?: string;
  articleids?: { idtype?: string; value?: string }[];
  pubdate?: string;
  authors?: { name?: string }[];
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJournal(value: string): string {
  return normalizeTitle(value)
    .replace(/\b(the|journal|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function titlesMatch(inputTitle: string, sourceTitle: string): boolean {
  const a = normalizeTitle(inputTitle);
  const b = normalizeTitle(sourceTitle);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a) || tokenSimilarity(a, b) >= 0.72);
}

function journalsMatch(inputJournal: string, sourceJournal: string): boolean {
  const a = normalizeJournal(inputJournal);
  const b = normalizeJournal(sourceJournal);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a) || tokenSimilarity(a, b) >= 0.55);
}

function normalizeTextId(value?: string | number | null): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function normalizeDoi(doi?: string | number | null): string | undefined {
  return normalizeTextId(doi)?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function fetchPubMedByPmid(pmid: string): Promise<PubMedDoc | null> {
  const url =
    `${PUBMED_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${encodeURIComponent(pmid)}` +
    (process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`PubMed verification failed: HTTP ${res.status}`);
  const json = (await res.json()) as PubMedSummary;
  const uid = json.result?.uids?.[0];
  if (!uid) return null;
  return (json.result?.[uid] as PubMedDoc | undefined) ?? null;
}

async function verifyWithPubMed(input: ArticleVerificationInput): Promise<ArticleVerificationResult> {
  const pmid = normalizeTextId(input.pmid);
  if (!pmid) return { ok: false, error: "Missing PMID." };

  const doc = await fetchPubMedByPmid(pmid);
  if (!doc?.title) return { ok: false, error: `PMID ${pmid} does not exist in PubMed.` };

  if (!titlesMatch(input.titleEn, doc.title)) {
    return { ok: false, error: `PMID ${pmid} title does not match input title.` };
  }

  const sourceJournal = doc.fulljournalname ?? doc.source ?? "";
  if (!journalsMatch(input.journal, sourceJournal)) {
    return { ok: false, error: `PMID ${pmid} journal does not match input journal.` };
  }

  const sourceDoi = normalizeDoi(doc.articleids?.find((id) => id.idtype === "doi")?.value);
  const inputDoi = normalizeDoi(input.doi);
  if (inputDoi && sourceDoi && inputDoi !== sourceDoi) {
    return { ok: false, error: `PMID ${pmid} DOI does not match input DOI.` };
  }

  const publishDate = parseDate(doc.pubdate) ?? input.publishDate ?? undefined;
  if (!publishDate) {
    return { ok: false, error: `PMID ${pmid} is missing a verifiable publication date.` };
  }

  return {
    ok: true,
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    verifiedData: {
      titleEn: doc.title,
      journal: sourceJournal || input.journal,
      doi: inputDoi ?? sourceDoi,
      pmid,
      publishDate,
      abstract: input.abstract ?? undefined,
      authors: doc.authors?.map((a) => a.name).filter((name): name is string => Boolean(name)) ?? [],
      sourceProvider: "pubmed",
    },
  };
}

async function verifyWithCrossRef(input: ArticleVerificationInput): Promise<ArticleVerificationResult> {
  const doi = normalizeDoi(input.doi);
  if (!doi) return { ok: false, error: "Missing DOI." };

  const work = await enrichFromCrossref(doi);
  const sourceTitle = work.title?.[0];
  if (!sourceTitle || !work.DOI) return { ok: false, error: `DOI ${doi} does not exist in CrossRef.` };

  if (!titlesMatch(input.titleEn, sourceTitle)) {
    return { ok: false, error: `DOI ${doi} title does not match input title.` };
  }

  const sourceJournal = work["container-title"]?.[0] ?? "";
  if (sourceJournal && !journalsMatch(input.journal, sourceJournal)) {
    return { ok: false, error: `DOI ${doi} journal does not match input journal.` };
  }

  const publishDate = parseCrossrefDate(work.published) ?? input.publishDate ?? undefined;
  if (!publishDate) {
    return { ok: false, error: `DOI ${doi} is missing a verifiable publication date.` };
  }

  return {
    ok: true,
    sourceUrl: `https://doi.org/${doi}`,
    verifiedData: {
      titleEn: sourceTitle,
      journal: sourceJournal || input.journal,
      doi: normalizeDoi(work.DOI) ?? doi,
      pmid: normalizeTextId(input.pmid),
      publishDate,
      abstract: work.abstract?.replace(/<[^>]+>/g, "") ?? input.abstract ?? undefined,
      authors: parseCrossrefAuthors(work.author),
      sourceProvider: "crossref",
    },
  };
}

export async function verifyArticle(input: ArticleVerificationInput): Promise<ArticleVerificationResult> {
  if (!input.pmid && !input.doi) {
    return {
      ok: false,
      error: "Missing both PMID and DOI, cannot verify article authenticity.",
    };
  }

  if (input.pmid) {
    try {
      const result = await verifyWithPubMed(input);
      if (result.ok || !input.doi) return result;
    } catch (e) {
      if (!input.doi) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  if (input.doi) return verifyWithCrossRef(input);

  return {
    ok: false,
    error: "Article could not be verified by PubMed or CrossRef.",
  };
}

export function mergeVerifiedData(paper: RawPaper, verified: VerifiedArticleData, sourceUrl?: string): RawPaper {
  return {
    ...paper,
    titleEn: verified.titleEn,
    journal: verified.journal,
    doi: verified.doi ?? paper.doi,
    pmid: verified.pmid ?? paper.pmid,
    publishDate: verified.publishDate,
    abstract: verified.abstract ?? paper.abstract,
    authors: verified.authors.length ? verified.authors : paper.authors,
    externalUrl: sourceUrl ?? paper.externalUrl,
  };
}
