import type { Specialty } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { backfillMissingAiAnalysis } from "../src/lib/pipeline/ai-analysis";

const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "10");
const specialtyArg = process.argv.find((arg) => arg.startsWith("--specialty="))?.split("=")[1] as Specialty | undefined;

async function main() {
  const result = await backfillMissingAiAnalysis(limitArg, specialtyArg);
  console.log(`[ai-analysis] done. selected=${result.selected}, updated=${result.updated}, failed=${result.failed}`);
  for (const error of result.errors) console.error(`[ai-analysis] ${error}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
