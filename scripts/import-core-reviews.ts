import type { Specialty } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { classifyStudyType } from "../src/lib/classifier";
import { CORE_LIBRARY_YEARS, CORE_MIN_IMPACT_FACTOR, SPECIALTY_CONFIG } from "../src/lib/constants";
import { fetchPubMedReviewLibrary } from "../src/lib/fetchers/pubmed";
import { resolveImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";

const prisma = new PrismaClient();
const specialties = Object.keys(SPECIALTY_CONFIG) as Specialty[];
const pageSize = Number(process.argv.find((arg) => arg.startsWith("--page-size="))?.split("=")[1] ?? "80");
const pages = Number(process.argv.find((arg) => arg.startsWith("--pages="))?.split("=")[1] ?? "4");

async function main() {
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalBelowIf = 0;

  for (const specialty of specialties) {
    console.log(`\n[${specialty}] fetching review candidates...`);
    const candidates = [];
    for (let page = 0; page < pages; page++) {
      const retStart = page * pageSize;
      const pageCandidates = await fetchPubMedReviewLibrary(
        specialty,
        CORE_LIBRARY_YEARS,
        pageSize,
        retStart
      );
      console.log(`[${specialty}] page=${page + 1}/${pages}, candidates=${pageCandidates.length}`);
      candidates.push(...pageCandidates);
      if (pageCandidates.length < pageSize) break;
    }

    const unique = Array.from(
      new Map(candidates.map((paper) => [paper.doi ?? paper.pmid ?? paper.titleEn.toLowerCase(), paper])).values()
    );
    totalFetched += unique.length;
    console.log(`[${specialty}] unique candidates=${unique.length}`);

    let accepted = 0;
    let rejected = 0;
    let belowIf = 0;

    for (const paper of unique) {
      const impactFactor = await resolveImpactFactor(paper.journal);
      if (impactFactor < CORE_MIN_IMPACT_FACTOR) {
        belowIf++;
        continue;
      }

      const studyType = classifyStudyType({
        ...paper,
        articleType: paper.articleType ? `${paper.articleType}; Review` : "Review",
      });

      const id = await upsertArticleRecord(
        {
          ...paper,
          articleType: paper.articleType ? `${paper.articleType}; Review` : "Review",
        },
        impactFactor,
        studyType,
        {
          asCoreLibrary: true,
          runLlm: true,
        }
      );

      if (id) accepted++;
      else rejected++;
    }

    totalAccepted += accepted;
    totalRejected += rejected;
    totalBelowIf += belowIf;
    console.log(`[${specialty}] accepted=${accepted}, rejected=${rejected}, belowIf=${belowIf}`);
  }

  const verifiedCore = await prisma.article.count({
    where: {
      isCoreLibrary: true,
      verificationStatus: "VERIFIED",
      impactFactor: { gte: CORE_MIN_IMPACT_FACTOR },
    },
  });

  console.log(
    `\nDone. fetched=${totalFetched}, accepted=${totalAccepted}, rejected=${totalRejected}, belowIf=${totalBelowIf}, verifiedCoreTotal=${verifiedCore}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
