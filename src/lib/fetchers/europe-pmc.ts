import type { Specialty } from "@prisma/client";
import type { RawPaper } from "../types";
import { SPECIALTY_CONFIG } from "../constants";

interface EuropePmcResult {
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
  authorString?: string;
  firstPublicationDate?: string;
  keywordList?: { keyword?: string[] };
  pubTypeList?: { pubType?: string[] };
}

/**
 * Europe PMC：欧洲生物医学文献库，作为 PubMed 的补充数据源。
 */
export async function fetchEuropePmcRecent(
  specialty: Specialty,
  maxResults = 30
): Promise<RawPaper[]> {
  const cfg = SPECIALTY_CONFIG[specialty];
  const query = `${cfg.pubmedQuery} AND FIRST_PDATE:[${yesterday()} TO ${today()}]`;
  const url =
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?` +
    `query=${encodeURIComponent(query)}&format=json&pageSize=${maxResults}&sort=P_DATE desc`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as EuropePmcResult;
  const hits = data.resultList?.result ?? [];

  return hits.map((h) => ({
    titleEn: h.title ?? "",
    abstract: h.abstractText,
    journal: h.journalTitle ?? "Unknown",
    doi: h.doi,
    pmid: h.pmid,
    authors: h.authorString?.split(", ") ?? [],
    publishDate: h.firstPublicationDate ? new Date(h.firstPublicationDate) : new Date(),
    keywords: h.keywordList?.keyword ?? [],
    articleType: h.pubTypeList?.pubType?.join("; "),
    externalUrl: h.pmid
      ? `https://europepmc.org/article/MED/${h.pmid}`
      : h.doi
        ? `https://doi.org/${h.doi}`
        : undefined,
    specialty,
  })).filter((p) => p.titleEn.length > 5);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
