import { PrismaClient } from "@prisma/client";
import journalData from "../data/journal-impact-factors.json";

const prisma = new PrismaClient();

async function main() {
  let count = 0;
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
    count++;
  }

  console.log(`Seeded ${count} journal impact-factor records. No article metadata was generated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
