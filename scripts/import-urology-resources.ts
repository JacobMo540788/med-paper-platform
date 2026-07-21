import { PrismaClient } from "@prisma/client";
import { classifyStudyType } from "../src/lib/classifier";
import {
  BASIC_STUDY_TERMS,
  CLINICAL_STUDY_TERMS,
  PIPELINE_STATUS,
  RESOURCE_KIND,
  ROLLING_WINDOW_YEARS,
  UROLOGY_QUERY_GROUPS,
  UROLOGY_SPECIALTY,
  type ResourceKind,
} from "../src/lib/constants";
import { fetchPubMedPaged } from "../src/lib/fetchers/pubmed";
import { resolveJournalImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";
import type { RawPaper } from "../src/lib/types";

const prisma = new PrismaClient();
const pageSize = Number(process.argv.find((arg) => arg.startsWith("--page-size="))?.split("=")[1] ?? "80");
const maxRecords = Number(process.argv.find((arg) => arg.startsWith("--max-records="))?.split("=")[1] ?? "160");
const years = Number(process.argv.find((arg) => arg.startsWith("--years="))?.split("=")[1] ?? ROLLING_WINDOW_YEARS);
const runLlm = !process.argv.includes("--no-llm");

type Candidate = RawPaper & { resourceKind: ResourceKind; diseaseArea: string };

function dateWindow() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - years);
  return {
    from,
    to,
    filter: `("${from.toISOString().slice(0, 10).replaceAll("-", "/")}"[PDAT] : "${to
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "/")}"[PDAT])`,
  };
}

function fieldTerms(terms: string[]) {
  return terms.map((term) => `"${term}"[Title/Abstract]`).join(" OR ");
}

function diseaseTerms(group: (typeof UROLOGY_QUERY_GROUPS)[number]) {
  return [
    ...group.mesh.map((m) => `"${m}"[MeSH Terms]`),
    ...group.keywords.map((k) => `"${k}"[Title/Abstract]`),
    ...(group.abbreviations ?? []).map((k) => `"${k}"[Title/Abstract]`),
  ].join(" OR ");
}

function buildQueries() {
  const { filter } = dateWindow();
  const exclude =
    "NOT (Editorial[Publication Type] OR Letter[Publication Type] OR News[Publication Type] OR Comment[Publication Type] OR Erratum[Publication Type] OR Case Reports[Publication Type] OR Congress[Publication Type])";
  return UROLOGY_QUERY_GROUPS.flatMap((group) => {
    const disease = diseaseTerms(group);
    return [
      {
        kind: RESOURCE_KIND.GUIDELINE,
        diseaseArea: group.diseaseArea,
        label: `${group.id}:guideline`,
        term: `(${disease}) AND ${filter} AND (Guideline[Publication Type] OR Practice Guideline[Publication Type] OR consensus[Title/Abstract] OR guideline[Title]) AND english[Language]`,
      },
      {
        kind: RESOURCE_KIND.CLINICAL_RESEARCH,
        diseaseArea: group.diseaseArea,
        label: `${group.id}:clinical`,
        term: `(${disease}) AND ${filter} AND ${exclude} AND (${fieldTerms(CLINICAL_STUDY_TERMS)}) AND english[Language]`,
      },
      {
        kind: RESOURCE_KIND.BASIC_RESEARCH,
        diseaseArea: group.diseaseArea,
        label: `${group.id}:basic`,
        term: `(${disease}) AND ${filter} AND ${exclude} AND (${fieldTerms([
          ...BASIC_STUDY_TERMS,
          ...(group.basicKeywords ?? []),
        ])}) AND english[Language]`,
      },
    ];
  });
}

function unique(items: Candidate[]) {
  return Array.from(
    new Map(
      items.map((paper) => [
        paper.doi?.toLowerCase() ??
          paper.pmid ??
          `${paper.titleEn.toLowerCase().replace(/\s+/g, " ")}:${paper.authors[0] ?? ""}:${paper.publishDate.getFullYear()}`,
        paper,
      ])
    ).values()
  );
}

async function importCandidates() {
  const candidates: Candidate[] = [];
  const queryReports = [];

  for (const query of buildQueries()) {
    console.log(`\n[urology:${query.label}] fetching candidates...`);
    const result = await fetchPubMedPaged(query.term, UROLOGY_SPECIALTY, {
      retMax: pageSize,
      maxRecords,
      sort: "relevance",
    });
    queryReports.push({
      label: query.label,
      totalHits: result.totalHits,
      requested: result.requested,
    });
    candidates.push(
      ...result.papers.map((paper) => ({
        ...paper,
        resourceKind: query.kind,
        diseaseArea: query.diseaseArea,
      }))
    );
    console.log(`[urology:${query.label}] hits=${result.totalHits}, requested=${result.requested}`);
  }

  const deduped = unique(candidates).filter((p) => p.doi || p.pmid);
  let published = 0;
  let manualReview = 0;
  let rejected = 0;
  let sourceErrors = 0;
  const pendingJif = new Set<string>();

  for (const paper of deduped) {
    const isGuideline = paper.resourceKind === RESOURCE_KIND.GUIDELINE;
    const jif = isGuideline
      ? { impactFactor: 0, status: "NOT_APPLICABLE" as const, jifYear: null, source: null }
      : await resolveJournalImpactFactor(paper.journal);
    if (jif.status !== "VERIFIED" && !isGuideline) pendingJif.add(paper.journal);

    const studyType =
      paper.resourceKind === RESOURCE_KIND.BASIC_RESEARCH
        ? "BASIC"
        : classifyStudyType({
            ...paper,
            articleType: isGuideline ? `${paper.articleType ?? ""}; Guideline` : paper.articleType,
          });

    const id = await upsertArticleRecord(
      {
        ...paper,
        articleType: isGuideline ? `${paper.articleType ?? ""}; Guideline` : paper.articleType,
      },
      jif.impactFactor ?? 0,
      studyType,
      {
        asHistory: true,
        asCoreLibrary: !isGuideline && jif.status === "VERIFIED" && (jif.impactFactor ?? 0) >= 10,
        resourceKind: paper.resourceKind,
        diseaseArea: paper.diseaseArea,
        runLlm,
        jifStatus: jif.status,
        jifYear: jif.jifYear ?? null,
        jifSource: jif.source ?? null,
        guidelineType: isGuideline ? "正式指南/共识/指南更新" : null,
        versionYear: isGuideline ? paper.publishDate.getFullYear() : null,
        sourceRecordId: paper.pmid ?? paper.doi ?? null,
        rawMetadata: {
          provider: paper.sourceProvider ?? "pubmed",
          pmid: paper.pmid,
          doi: paper.doi,
          titleEn: paper.titleEn,
          journal: paper.journal,
          articleType: paper.articleType,
          diseaseArea: paper.diseaseArea,
          resourceKind: paper.resourceKind,
          jif,
        },
        inclusionEvidence: isGuideline
          ? "PubMed guideline/practice guideline/consensus query with DOI or PMID verification."
          : "PubMed urology query with DOI or PMID verification; JIF gates decide publication eligibility.",
      }
    );

    if (!id) {
      sourceErrors++;
      continue;
    }
    const saved = await prisma.article.findUnique({ where: { id }, select: { pipelineStatus: true } });
    if (saved?.pipelineStatus === PIPELINE_STATUS.PUBLISHED) published++;
    else if (saved?.pipelineStatus === PIPELINE_STATUS.REJECTED) rejected++;
    else manualReview++;
  }

  return {
    queryReports,
    discovered: candidates.length,
    deduped: deduped.length,
    published,
    manualReview,
    rejected,
    sourceErrors,
    pendingJif: [...pendingJif].sort(),
  };
}

async function main() {
  const report = await importCandidates();
  const counts = await prisma.article.groupBy({
    by: ["resourceKind", "pipelineStatus"],
    where: { specialty: UROLOGY_SPECIALTY },
    _count: { _all: true },
  });

  console.log("\n[urology] import done.");
  console.log(JSON.stringify({ report, counts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
