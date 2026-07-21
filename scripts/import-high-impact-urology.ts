import { classifyStudyType } from "../src/lib/classifier";
import { RESOURCE_KIND, ROLLING_WINDOW_YEARS, SPECIALTY_CONFIG, UROLOGY_SPECIALTY, type ResourceKind } from "../src/lib/constants";
import { fetchPubMedPaged } from "../src/lib/fetchers/pubmed";
import { resolveJournalImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";

const maxRecords = Number(process.argv.find((arg) => arg.startsWith("--max-records="))?.split("=")[1] ?? "160");
const pageSize = Number(process.argv.find((arg) => arg.startsWith("--page-size="))?.split("=")[1] ?? "80");
const runLlm = !process.argv.includes("--no-llm");

const HIGH_CLINICAL_JOURNALS = [
  '"Journal of Clinical Oncology"[Journal]',
  '"Annals of Oncology"[Journal]',
  '"European Urology"[Journal]',
  '"JAMA Oncology"[Journal]',
  '"Clinical Cancer Research"[Journal]',
  '"Nature Medicine"[Journal]',
  '"New England Journal of Medicine"[Journal]',
  '"Lancet"[Journal]',
  '"JAMA"[Journal]',
];

const HIGH_BASIC_JOURNALS = [
  '"Cancer Research"[Journal]',
  '"Cancer Discovery"[Journal]',
  '"Cancer Cell"[Journal]',
  '"Nature Medicine"[Journal]',
  '"Nature Communications"[Journal]',
  '"Cell"[Journal]',
  '"Science Translational Medicine"[Journal]',
];

function dateFilter() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - ROLLING_WINDOW_YEARS);
  return `("${from.toISOString().slice(0, 10).replaceAll("-", "/")}"[PDAT] : "${to
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "/")}"[PDAT])`;
}

function buildQueries() {
  const urology = SPECIALTY_CONFIG[UROLOGY_SPECIALTY].pubmedQuery;
  return [
    {
      label: "clinical-high-impact",
      kind: RESOURCE_KIND.CLINICAL_RESEARCH,
      term: `(${urology}) AND (${HIGH_CLINICAL_JOURNALS.join(" OR ")}) AND ${dateFilter()} AND english[Language]`,
    },
    {
      label: "basic-high-impact",
      kind: RESOURCE_KIND.BASIC_RESEARCH,
      term: `(${urology}) AND (${HIGH_BASIC_JOURNALS.join(" OR ")}) AND ${dateFilter()} AND english[Language]`,
    },
  ];
}

function unique<T extends { doi?: string; pmid?: string; titleEn: string; publishDate: Date; authors: string[] }>(
  items: T[]
) {
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

async function importKind(kind: ResourceKind, label: string, term: string) {
  console.log(`\n[high-impact:${label}] fetching...`);
  const relevance = await fetchPubMedPaged(term, UROLOGY_SPECIALTY, {
    retMax: pageSize,
    maxRecords,
    sort: "relevance",
  });
  const byDate = await fetchPubMedPaged(term, UROLOGY_SPECIALTY, {
    retMax: Math.min(pageSize, 50),
    maxRecords: Math.min(maxRecords, 80),
    sort: "date",
  });
  const candidates = unique([...relevance.papers, ...byDate.papers])
    .filter((p) => p.doi || p.pmid)
    .filter((p) => {
      const text = `${p.titleEn} ${p.abstract ?? ""} ${p.articleType ?? ""}`.toLowerCase();
      if (/editorial|comment|letter|reply|case report|erratum|correction|news/.test(text)) return false;
      if (kind === RESOURCE_KIND.CLINICAL_RESEARCH) {
        return /randomized|clinical trial|phase iii|phase 3|cohort|prospective|retrospective|real-world|survival|meta-analysis|systematic review|patients?/.test(text);
      }
      return /mechanism|molecular|cell line|organoid|mouse|mice|single-cell|transcriptom|proteom|metabolom|microenvironment|preclinical|xenograft|pathway|signaling/.test(text);
    });
  console.log(
    `[high-impact:${label}] hits=${relevance.totalHits}, requested=${relevance.requested + byDate.requested}, deduped=${candidates.length}`
  );

  let published = 0;
  let manualReview = 0;
  let rejected = 0;
  const pendingJif = new Set<string>();

  for (const paper of candidates) {
    const jif = await resolveJournalImpactFactor(paper.journal);
    if (jif.status !== "VERIFIED") pendingJif.add(paper.journal);
    const studyType = kind === RESOURCE_KIND.BASIC_RESEARCH ? "BASIC" : classifyStudyType(paper);
    const id = await upsertArticleRecord(paper, jif.impactFactor ?? 0, studyType, {
      asHistory: true,
      asCoreLibrary: jif.status === "VERIFIED" && (jif.impactFactor ?? 0) >= 10,
      resourceKind: kind,
      runLlm,
      jifStatus: jif.status,
      jifYear: jif.jifYear ?? null,
      jifSource: jif.source ?? null,
      sourceRecordId: paper.pmid ?? paper.doi ?? null,
      rawMetadata: {
        provider: paper.sourceProvider ?? "pubmed",
        pmid: paper.pmid,
        doi: paper.doi,
        titleEn: paper.titleEn,
        journal: paper.journal,
        articleType: paper.articleType,
        sourceQuery: label,
        jif,
      },
      inclusionEvidence:
        "Targeted PubMed high-impact urology query with DOI or PMID verification, strict publication-type exclusion, and verified JIF gate.",
    });
    if (!id) {
      rejected++;
      continue;
    }
    const saved = await import("../src/lib/db").then(({ prisma }) =>
      prisma.article.findUnique({ where: { id }, select: { pipelineStatus: true } })
    );
    if (saved?.pipelineStatus === "PUBLISHED") published++;
    else if (saved?.pipelineStatus === "REJECTED") rejected++;
    else manualReview++;
  }

  console.log(
    `[high-impact:${label}] published=${published}, manualReview=${manualReview}, rejected=${rejected}, pendingJif=${pendingJif.size}`
  );
  if (pendingJif.size) console.log([...pendingJif].sort().join("\n"));
  return { label, hits: relevance.totalHits, candidates: candidates.length, published, manualReview, rejected };
}

async function main() {
  const reports = [];
  for (const query of buildQueries()) {
    reports.push(await importKind(query.kind, query.label, query.term));
  }
  console.log("\n[high-impact] done.");
  console.log(JSON.stringify(reports, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
