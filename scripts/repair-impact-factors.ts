import { PrismaClient } from "@prisma/client";
import { PIPELINE_STATUS, RESOURCE_KIND, UROLOGY_SPECIALTY, type ResourceKind } from "../src/lib/constants";
import { resolveJournalImpactFactor, seedJournalTable } from "../src/lib/journal-if";
import { decidePipelineStatus } from "../src/lib/pipeline/urology-rules";
import type { RawPaper } from "../src/lib/types";

const prisma = new PrismaClient();

function asResourceKind(value: string): ResourceKind {
  if (value === RESOURCE_KIND.GUIDELINE) return RESOURCE_KIND.GUIDELINE;
  if (value === RESOURCE_KIND.BASIC_RESEARCH) return RESOURCE_KIND.BASIC_RESEARCH;
  if (value === RESOURCE_KIND.LIU_BEN_LAB) return RESOURCE_KIND.LIU_BEN_LAB;
  return RESOURCE_KIND.CLINICAL_RESEARCH;
}

function toRawPaper(article: {
  titleEn: string;
  abstract: string | null;
  journal: string;
  doi: string | null;
  pmid: string | null;
  authors: string[];
  publishDate: Date;
  keywords: string[];
  articleType: string | null;
  sourceProvider: string | null;
}): RawPaper {
  return {
    titleEn: article.titleEn,
    abstract: article.abstract ?? undefined,
    journal: article.journal,
    doi: article.doi ?? undefined,
    pmid: article.pmid ?? undefined,
    authors: article.authors,
    publishDate: article.publishDate,
    keywords: article.keywords,
    articleType: article.articleType ?? undefined,
    sourceProvider: article.sourceProvider ?? undefined,
    specialty: UROLOGY_SPECIALTY,
  };
}

async function main() {
  const journalCount = await seedJournalTable();
  const articles = await prisma.article.findMany({
    where: {
      specialty: UROLOGY_SPECIALTY,
      resourceKind: { in: [RESOURCE_KIND.GUIDELINE, RESOURCE_KIND.CLINICAL_RESEARCH, RESOURCE_KIND.BASIC_RESEARCH] },
      verificationStatus: "VERIFIED",
      pipelineStatus: { in: [PIPELINE_STATUS.PUBLISHED, PIPELINE_STATUS.MANUAL_REVIEW, PIPELINE_STATUS.REJECTED] },
    },
    select: {
      id: true,
      titleEn: true,
      abstract: true,
      journal: true,
      impactFactor: true,
      doi: true,
      pmid: true,
      authors: true,
      publishDate: true,
      keywords: true,
      articleType: true,
      sourceProvider: true,
      resourceKind: true,
      jifStatus: true,
      pipelineStatus: true,
    },
  });

  let updated = 0;
  let published = 0;
  let manualReview = 0;
  let rejected = 0;

  for (const article of articles) {
    const resourceKind = asResourceKind(article.resourceKind);
    const isGuideline = resourceKind === RESOURCE_KIND.GUIDELINE;
    const jif = isGuideline
      ? { impactFactor: 0, status: "NOT_APPLICABLE" as const, jifYear: null, source: null }
      : await resolveJournalImpactFactor(article.journal);
    const decision = decidePipelineStatus({
      paper: toRawPaper(article),
      resourceKind,
      impactFactor: jif.impactFactor ?? 0,
      jifStatus: jif.status,
      metadataVerified: true,
    });

    await prisma.article.update({
      where: { id: article.id },
      data: {
        impactFactor: jif.impactFactor ?? 0,
        jifStatus: jif.status,
        jifYear: jif.jifYear ?? null,
        jifSource: jif.source ?? null,
        jifVerifiedAt: jif.status === "VERIFIED" ? new Date() : null,
        pipelineStatus: decision.status,
        exclusionReasons: decision.exclusionReasons,
        isCoreLibrary: decision.canPublish && resourceKind !== RESOURCE_KIND.GUIDELINE,
        coreAddedAt: decision.canPublish && resourceKind !== RESOURCE_KIND.GUIDELINE ? new Date() : null,
        publishedAt: decision.canPublish ? new Date() : null,
        isInHistory: decision.canPublish,
      },
    });

    if (
      article.impactFactor !== (jif.impactFactor ?? 0) ||
      article.jifStatus !== jif.status ||
      article.pipelineStatus !== decision.status
    ) {
      updated++;
      console.log(
        `[repair-if] ${article.journal}: IF ${article.impactFactor} -> ${jif.impactFactor ?? 0}; ${article.pipelineStatus} -> ${decision.status}; ${article.titleEn.slice(0, 100)}`
      );
    }
    if (decision.status === PIPELINE_STATUS.PUBLISHED) published++;
    else if (decision.status === PIPELINE_STATUS.REJECTED) rejected++;
    else manualReview++;
  }

  console.log(
    `[repair-if] done. journalsSeeded=${journalCount}, scanned=${articles.length}, updated=${updated}, published=${published}, manualReview=${manualReview}, rejected=${rejected}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
