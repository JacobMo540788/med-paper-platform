import { PrismaClient } from "@prisma/client";
import { verifyArticle } from "../src/lib/validation/article-verifier";

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "asc" },
  });

  let verified = 0;
  let failed = 0;

  for (const article of articles) {
    const result = await verifyArticle({
      titleEn: article.titleEn,
      journal: article.journal,
      doi: article.doi,
      pmid: article.pmid,
      publishDate: article.publishDate,
      abstract: article.abstract,
      sourceProvider: article.sourceProvider,
    });

    if (result.ok && result.verifiedData) {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          titleEn: result.verifiedData.titleEn,
          journal: result.verifiedData.journal,
          doi: result.verifiedData.doi ?? article.doi,
          pmid: result.verifiedData.pmid ?? article.pmid,
          publishDate: result.verifiedData.publishDate,
          abstract: result.verifiedData.abstract ?? article.abstract,
          authors: result.verifiedData.authors.length ? result.verifiedData.authors : article.authors,
          sourceProvider: result.verifiedData.sourceProvider,
          sourceUrl: result.sourceUrl,
          verificationStatus: "VERIFIED",
          verificationError: null,
          lastVerifiedAt: new Date(),
        },
      });
      verified++;
      continue;
    }

    await prisma.article.update({
      where: { id: article.id },
      data: {
        verificationStatus: "FAILED",
        verificationError: result.error ?? "Article verification failed.",
        isTodayPick: false,
        isInHistory: false,
        isCoreLibrary: false,
      },
    });
    failed++;
  }

  console.log(`Revalidated ${articles.length} articles: ${verified} verified, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
