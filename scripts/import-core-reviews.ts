import type { Specialty } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { classifyStudyType } from "../src/lib/classifier";
import { SPECIALTY_CONFIG } from "../src/lib/constants";
import { fetchPubMedReviewLibrary } from "../src/lib/fetchers/pubmed";
import { resolveImpactFactor } from "../src/lib/journal-if";
import { upsertArticleRecord } from "../src/lib/pipeline/article-upsert";

const prisma = new PrismaClient();
const specialties = Object.keys(SPECIALTY_CONFIG) as Specialty[];

async function main() {
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalRejected = 0;

  for (const specialty of specialties) {
    console.log(`\n[${specialty}] fetching review candidates...`);
    const candidates = await fetchPubMedReviewLibrary(specialty, 10, 180);
    totalFetched += candidates.length;
    console.log(`[${specialty}] candidates=${candidates.length}`);

    let accepted = 0;
    let rejected = 0;

    for (const paper of candidates) {
      const impactFactor = await resolveImpactFactor(paper.journal);
      if (impactFactor < 15) continue;

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
          runLlm: false,
        }
      );

      if (id) accepted++;
      else rejected++;
    }

    totalAccepted += accepted;
    totalRejected += rejected;
    console.log(`[${specialty}] accepted=${accepted}, rejected=${rejected}`);
  }

  const verifiedCore = await prisma.article.count({
    where: {
      isCoreLibrary: true,
      verificationStatus: "VERIFIED",
      impactFactor: { gte: 15 },
    },
  });

  console.log(
    `\nDone. fetched=${totalFetched}, accepted=${totalAccepted}, rejected=${totalRejected}, verifiedCoreTotal=${verifiedCore}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
