import { Prisma, type Specialty } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { decodeHtmlEntities } from "../src/lib/html";
import { runFullLlmPipeline } from "../src/lib/llm/analyzer";

const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "10");
const specialtyArg = process.argv.find((arg) => arg.startsWith("--specialty="))?.split("=")[1] as
  | Specialty
  | undefined;

async function main() {
  if (!process.env.LLM_API_KEY) {
    throw new Error("LLM_API_KEY is not configured. Add it to .env or Netlify environment variables first.");
  }

  const articles = await prisma.article.findMany({
    where: {
      verificationStatus: "VERIFIED",
      aiAnalysisJson: { equals: Prisma.DbNull },
      abstract: { not: null },
      ...(specialtyArg ? { specialty: specialtyArg } : {}),
    },
    orderBy: [{ isTodayPick: "desc" }, { impactFactor: "desc" }, { publishDate: "desc" }],
    take: Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 10,
  });

  let updated = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const abstract = decodeHtmlEntities(article.abstract ?? "");
      const titleEn = decodeHtmlEntities(article.titleEn);
      const llm = await runFullLlmPipeline({
        titleEn,
        abstract,
        specialty: article.specialty,
        studyType: article.studyType,
        journal: article.journal,
      });

      await prisma.article.update({
        where: { id: article.id },
        data: {
          titleEn,
          abstract,
          titleCn: llm.titleCn,
          abstractCn: llm.abstractCn,
          aiSummary: llm.aiSummary,
          aiAnalysisJson: llm.aiAnalysis,
          keywordsBilingual: llm.aiAnalysis.keywords_cn_en,
        },
      });
      updated++;
      console.log(`[ai-analysis] updated ${article.id} ${titleEn}`);
    } catch (error) {
      failed++;
      console.error(
        `[ai-analysis] failed ${article.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(`[ai-analysis] done. selected=${articles.length}, updated=${updated}, failed=${failed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
