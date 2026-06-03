import { PrismaClient } from "@prisma/client";
import journalData from "../data/journal-impact-factors.json";
import { CORE_MIN_IMPACT_FACTOR, MIN_IMPACT_FACTOR } from "../src/lib/constants";
import { resolveImpactFactor } from "../src/lib/journal-if";

const prisma = new PrismaClient();

async function seedJournalIfTable() {
  for (const journal of journalData) {
    await prisma.journalIf.upsert({
      where: { journalName: journal.journalName },
      create: {
        journalName: journal.journalName,
        issn: journal.issn ?? null,
        impactFactor: journal.impactFactor,
        isTopJournal: journal.isTopJournal,
      },
      update: {
        issn: journal.issn ?? null,
        impactFactor: journal.impactFactor,
        isTopJournal: journal.isTopJournal,
      },
    });
  }
}

async function main() {
  await seedJournalIfTable();

  const articles = await prisma.article.findMany({
    select: {
      id: true,
      journal: true,
      impactFactor: true,
      isCoreLibrary: true,
      isTodayPick: true,
    },
  });

  let updated = 0;
  let removedCore = 0;
  let removedToday = 0;

  for (const article of articles) {
    const impactFactor = await resolveImpactFactor(article.journal);

    const data = {
      impactFactor,
      ...(article.isCoreLibrary && impactFactor < CORE_MIN_IMPACT_FACTOR
        ? { isCoreLibrary: false, coreAddedAt: null }
        : {}),
      ...(article.isTodayPick && impactFactor < MIN_IMPACT_FACTOR
        ? { isTodayPick: false, featuredDateKey: null }
        : {}),
    };

    if (
      impactFactor !== article.impactFactor ||
      (article.isCoreLibrary && impactFactor < CORE_MIN_IMPACT_FACTOR) ||
      (article.isTodayPick && impactFactor < MIN_IMPACT_FACTOR)
    ) {
      await prisma.article.update({ where: { id: article.id }, data });
      updated++;
      if (article.isCoreLibrary && impactFactor < CORE_MIN_IMPACT_FACTOR) removedCore++;
      if (article.isTodayPick && impactFactor < MIN_IMPACT_FACTOR) removedToday++;
      console.log(
        `[repair-if] ${article.journal}: ${article.impactFactor} -> ${impactFactor} (${article.id})`
      );
    }
  }

  console.log(
    `[repair-if] done. scanned=${articles.length}, updated=${updated}, removedCore=${removedCore}, removedToday=${removedToday}`
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
