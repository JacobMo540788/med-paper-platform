import { PrismaClient } from "@prisma/client";
import { classifyStudyType } from "../src/lib/classifier";
import {
  RESOURCE_KIND,
  RESEARCH_MIN_JIF,
  ROLLING_WINDOW_YEARS,
  UROLOGY_SPECIALTY,
  type ResourceKind,
} from "../src/lib/constants";
import { fetchPubMedSearch } from "../src/lib/fetchers/pubmed";
import { resolveImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";

const prisma = new PrismaClient();
const pageSize = Number(process.argv.find((arg) => arg.startsWith("--page-size="))?.split("=")[1] ?? "80");
const pages = Number(process.argv.find((arg) => arg.startsWith("--pages="))?.split("=")[1] ?? "2");

const startYear = new Date().getFullYear() - ROLLING_WINDOW_YEARS;
const dateFilter = `("${startYear}/01/01"[PDAT] : "3000"[PDAT])`;
const urologyFilter =
  "(urology[Title/Abstract] OR urologic[Title/Abstract] OR urological[Title/Abstract] OR prostate[Title/Abstract] OR bladder[Title/Abstract] OR renal cell carcinoma[Title/Abstract] OR upper tract urothelial[Title/Abstract] OR testicular[Title/Abstract] OR penile[Title/Abstract] OR urolithiasis[Title/Abstract] OR urinary tract infection[Title/Abstract] OR urinary incontinence[Title/Abstract] OR neuro-urology[Title/Abstract] OR erectile dysfunction[Title/Abstract] OR male infertility[Title/Abstract])";
const excludeFilter =
  "NOT (Editorial[Publication Type] OR Letter[Publication Type] OR News[Publication Type] OR Comment[Publication Type] OR Erratum[Publication Type] OR Case Reports[Publication Type] OR Congress[Publication Type])";

const QUERIES: { kind: ResourceKind; label: string; term: string }[] = [
  {
    kind: RESOURCE_KIND.GUIDELINE,
    label: "guidelines",
    term: `${urologyFilter} AND ${dateFilter} AND (Guideline[Publication Type] OR Practice Guideline[Publication Type] OR consensus[Title/Abstract] OR guideline[Title]) AND english[Language]`,
  },
  {
    kind: RESOURCE_KIND.CLINICAL_RESEARCH,
    label: "clinical",
    term: `${urologyFilter} AND ${dateFilter} AND ${excludeFilter} AND (Randomized Controlled Trial[Publication Type] OR Clinical Trial[Publication Type] OR Meta-Analysis[Publication Type] OR systematic review[Title/Abstract] OR cohort[Title/Abstract] OR real-world[Title/Abstract] OR phase III[Title/Abstract]) AND english[Language]`,
  },
  {
    kind: RESOURCE_KIND.BASIC_RESEARCH,
    label: "basic",
    term: `${urologyFilter} AND ${dateFilter} AND ${excludeFilter} AND (molecular[Title/Abstract] OR mechanism[Title/Abstract] OR tumor microenvironment[Title/Abstract] OR transcriptomic[Title/Abstract] OR single-cell[Title/Abstract] OR proteomic[Title/Abstract] OR metabolomic[Title/Abstract] OR mouse[Title/Abstract] OR mice[Title/Abstract] OR organoid[Title/Abstract] OR cell line[Title/Abstract]) AND english[Language]`,
  },
];

function unique<T extends { doi?: string; pmid?: string; titleEn: string }>(items: T[]) {
  return Array.from(
    new Map(items.map((paper) => [paper.doi?.toLowerCase() ?? paper.pmid ?? paper.titleEn.toLowerCase(), paper])).values()
  );
}

async function importKind(kind: ResourceKind, label: string, term: string) {
  console.log(`\n[urology:${label}] fetching candidates...`);
  const candidates = [];
  for (let page = 0; page < pages; page++) {
    const retStart = page * pageSize;
    const rows = await fetchPubMedSearch(term, UROLOGY_SPECIALTY, pageSize, retStart, "relevance");
    console.log(`[urology:${label}] page=${page + 1}/${pages}, candidates=${rows.length}`);
    candidates.push(...rows);
    if (rows.length < pageSize) break;
  }

  let accepted = 0;
  let rejected = 0;
  let belowJif = 0;
  const pendingJif = new Set<string>();

  for (const paper of unique(candidates).filter((p) => p.doi || p.pmid)) {
    const impactFactor = await resolveImpactFactor(paper.journal);
    const isGuideline = kind === RESOURCE_KIND.GUIDELINE;
    if (!isGuideline && impactFactor < RESEARCH_MIN_JIF) {
      if (impactFactor <= 0) pendingJif.add(paper.journal);
      belowJif++;
      continue;
    }

    const studyType =
      kind === RESOURCE_KIND.BASIC_RESEARCH
        ? "BASIC"
        : classifyStudyType({
            ...paper,
            articleType: kind === RESOURCE_KIND.GUIDELINE ? `${paper.articleType ?? ""}; Guideline` : paper.articleType,
          });

    const id = await upsertArticleRecord(
      {
        ...paper,
        articleType: kind === RESOURCE_KIND.GUIDELINE ? `${paper.articleType ?? ""}; Guideline` : paper.articleType,
      },
      isGuideline && impactFactor <= 0 ? 0 : impactFactor,
      studyType,
      {
        asHistory: true,
        asCoreLibrary: !isGuideline,
        resourceKind: kind,
        runLlm: true,
        jifStatus: isGuideline && impactFactor <= 0 ? "NOT_APPLICABLE" : "VERIFIED",
        jifYear: isGuideline && impactFactor <= 0 ? null : 2024,
        jifSource: isGuideline && impactFactor <= 0 ? null : "local JCR whitelist",
        guidelineType: isGuideline ? "正式指南/共识或指南更新" : null,
        versionYear: isGuideline ? paper.publishDate.getFullYear() : null,
        inclusionEvidence: isGuideline
          ? "PubMed guideline/practice guideline/consensus query with DOI or PMID verification."
          : "PubMed urology query with DOI or PMID verification and JIF threshold screening.",
      }
    );

    if (id) accepted++;
    else rejected++;
  }

  console.log(
    `[urology:${label}] fetched=${candidates.length}, accepted=${accepted}, rejected=${rejected}, belowOrPendingJif=${belowJif}`
  );
  if (pendingJif.size) {
    console.log(`[urology:${label}] pending JIF journals:\n${[...pendingJif].sort().join("\n")}`);
  }

  return { fetched: candidates.length, accepted, rejected, belowJif, pendingJif: [...pendingJif].sort() };
}

async function main() {
  const results = [];
  for (const q of QUERIES) {
    results.push(await importKind(q.kind, q.label, q.term));
  }

  const counts = await prisma.article.groupBy({
    by: ["resourceKind"],
    where: { specialty: UROLOGY_SPECIALTY, verificationStatus: "VERIFIED" },
    _count: { _all: true },
  });

  console.log("\n[urology] import done.");
  console.log(JSON.stringify({ results, counts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
