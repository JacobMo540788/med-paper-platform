import type { Specialty } from "@prisma/client";
import { CORE_LIBRARY_YEARS, RESOURCE_KIND, SPECIALTY_CONFIG } from "../constants";
import { classifyStudyType } from "../classifier";
import { fetchPubMedCoreLibrary } from "../fetchers/pubmed";
import { enrichFromCrossref, parseCrossrefAuthors, parseCrossrefDate } from "../fetchers/crossref";
import {
  isTopJournalName,
  passesCoreIfFilter,
  resolveImpactFactor,
} from "../journal-if";
import type { RawPaper } from "../types";
import { upsertArticleRecord } from "./article-upsert";

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
  } catch (e) {
    console.error(`[core-crossref-enrich] ${paper.doi} failed:`, e);
    return paper;
  }
}

/**
 * 核心文献库：近15年、IF>15、顶刊优先收录。
 */
export async function runCoreLibrarySyncForSpecialty(specialty: Specialty): Promise<{
  fetched: number;
  accepted: number;
}> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - CORE_LIBRARY_YEARS);

  const rawList = dedupePapers(await fetchPubMedCoreLibrary(specialty));
  let accepted = 0;

  const sorted = [...rawList].sort((a, b) => {
    const aTop = isTopJournalName(a.journal) ? 1 : 0;
    const bTop = isTopJournalName(b.journal) ? 1 : 0;
    return bTop - aTop;
  });

  for (const raw of sorted) {
    const paper = await enrichPaper(raw);
    if (paper.publishDate < cutoff) continue;

    const ifVal = await resolveImpactFactor(paper.journal);
    if (!passesCoreIfFilter(ifVal)) continue;

    const studyType = classifyStudyType(paper);
    const articleId = await upsertArticleRecord(paper, ifVal, studyType, {
      asCoreLibrary: true,
      resourceKind: studyType === "BASIC" ? RESOURCE_KIND.BASIC_RESEARCH : RESOURCE_KIND.CLINICAL_RESEARCH,
      runLlm: !process.env.SKIP_CORE_LLM,
    });
    if (articleId) accepted++;
  }

  return { fetched: rawList.length, accepted };
}

export async function runCoreLibrarySyncAll(): Promise<{ totalAccepted: number }> {
  const specialties = (Object.keys(SPECIALTY_CONFIG) as Specialty[]).filter((s) => SPECIALTY_CONFIG[s].active);

  let totalAccepted = 0;
  for (const specialty of specialties) {
    try {
      const r = await runCoreLibrarySyncForSpecialty(specialty);
      totalAccepted += r.accepted;
    } catch (e) {
      console.error(`[core-library] ${specialty} failed:`, e);
    }
  }
  return { totalAccepted };
}
