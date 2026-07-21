import { prisma } from "../src/lib/db";
import { classifyStudyType } from "../src/lib/classifier";
import { RESOURCE_KIND, UROLOGY_SPECIALTY } from "../src/lib/constants";
import {
  enrichFromCrossref,
  parseCrossrefAuthors,
  parseCrossrefDate,
} from "../src/lib/fetchers/crossref";
import { fetchPubMedSearch } from "../src/lib/fetchers/pubmed";
import { resolveImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";
import type { RawPaper } from "../src/lib/types";
import disambiguation from "../data/liu-ben-lab-disambiguation.json";

type ReviewedPaper = (typeof disambiguation.papers)[number];

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const doiArg = process.argv.find((arg) => arg.startsWith("--doi="));
const requestedDois = new Set(
  (doiArg?.split("=")[1] ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
);
const reviewedPapers = requestedDois.size
  ? disambiguation.papers.filter((paper) => requestedDois.has(paper.doi.toLowerCase()))
  : disambiguation.papers;
const limit = limitArg ? Number(limitArg.split("=")[1]) : reviewedPapers.length;
const runLlm = !process.argv.includes("--no-llm");

function normalizeDoi(value?: string | null) {
  return value?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() ?? "";
}

async function fetchReviewedPaper(entry: ReviewedPaper): Promise<RawPaper | null> {
  if (entry.pmid) {
    const rows = await fetchPubMedSearch(`${entry.pmid}[PMID]`, UROLOGY_SPECIALTY, 1);
    const exact = rows.find((row) => String(row.pmid ?? "") === entry.pmid);
    if (!exact) return null;
    if (entry.doi && normalizeDoi(exact.doi) !== normalizeDoi(entry.doi)) return null;
    return exact;
  }

  const work = await enrichFromCrossref(entry.doi);
  const titleEn = work.title?.[0];
  const publishDate = parseCrossrefDate(work.published) ?? new Date(entry.date);
  if (!titleEn || !work.DOI || Number.isNaN(publishDate.getTime())) return null;
  if (normalizeDoi(work.DOI) !== normalizeDoi(entry.doi)) return null;

  return {
    titleEn,
    abstract: work.abstract?.replace(/<[^>]+>/g, ""),
    journal: work["container-title"]?.[0] ?? "Preprint",
    doi: normalizeDoi(work.DOI),
    authors: parseCrossrefAuthors(work.author),
    publishDate,
    keywords: work.subject ?? [],
    articleType: work.type,
    externalUrl: `https://doi.org/${normalizeDoi(work.DOI)}`,
    sourceProvider: "crossref",
    specialty: UROLOGY_SPECIALTY,
  };
}

function evidenceText(entry: ReviewedPaper) {
  return [
    `人工消歧清单 v${disambiguation.version}（${disambiguation.reviewedAt}）`,
    `已核验课题组成员：${entry.members.join("、")}`,
    `证据来源：${entry.evidenceSources.join("、")}`,
    "匹配规则：仅接受清单内精确 DOI/PMID；短姓名不能单独作为身份依据",
  ].join("；");
}

async function main() {
  let imported = 0;
  let rejected = 0;
  const selected = reviewedPapers.slice(0, Math.max(0, limit));

  console.log(
    `[liu-ben-lab] reviewed members=${disambiguation.members.length}, papers=${selected.length}, llm=${runLlm}`
  );

  for (const [index, entry] of selected.entries()) {
    try {
      const paper = await fetchReviewedPaper(entry);
      if (!paper) {
        rejected++;
        console.error(`[liu-ben-lab] rejected ${entry.doi || entry.pmid}: authoritative identifier mismatch`);
        continue;
      }

      const impactFactor = await resolveImpactFactor(paper.journal);
      const isPreprint = /^10\.(21203|2139)\//.test(normalizeDoi(entry.doi));
      const id = await upsertArticleRecord(paper, impactFactor, classifyStudyType(paper), {
        asHistory: true,
        resourceKind: RESOURCE_KIND.LIU_BEN_LAB,
        runLlm,
        jifStatus: isPreprint ? "NOT_APPLICABLE" : impactFactor > 0 ? "VERIFIED" : "PENDING",
        jifYear: impactFactor > 0 ? 2024 : null,
        jifSource: impactFactor > 0 ? "local JCR whitelist" : null,
        liuBenRole: entry.liuBenRole,
        inclusionEvidence: evidenceText(entry),
      });

      if (id) imported++;
      else rejected++;
      console.log(`[liu-ben-lab] ${index + 1}/${selected.length} ${id ? "imported" : "rejected"}: ${entry.doi}`);
    } catch (error) {
      rejected++;
      console.error(`[liu-ben-lab] failed ${entry.doi || entry.pmid}:`, error);
    }
  }

  const stored = await prisma.article.count({
    where: { resourceKind: RESOURCE_KIND.LIU_BEN_LAB, verificationStatus: "VERIFIED" },
  });
  console.log(JSON.stringify({ reviewed: selected.length, imported, rejected, stored }, null, 2));
  if (rejected > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
