import journalData from "../../data/journal-impact-factors.json";
import { prisma } from "./db";
import { TOP_JOURNAL_KEYWORDS } from "./constants";

export interface JournalRecord {
  journalName: string;
  issn?: string;
  impactFactor: number;
  isTopJournal: boolean;
}

const localMap = new Map<string, JournalRecord>();
const JOURNAL_ALIASES: Record<string, string> = {
  "n engl j med": "new england journal of medicine",
  "the new england journal of medicine": "new england journal of medicine",
  "new engl j med": "new england journal of medicine",
  "the lancet": "lancet",
};

function normalizeJournalName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[.:,;]+$/g, "").replace(/\s+/g, " ");
  return JOURNAL_ALIASES[normalized] ?? normalized;
}

function loadLocal(): void {
  if (localMap.size > 0) return;
  for (const j of journalData as JournalRecord[]) {
    localMap.set(normalizeJournalName(j.journalName), j);
  }
}

export function isTopJournalName(journal: string): boolean {
  const n = normalizeJournalName(journal);
  return TOP_JOURNAL_KEYWORDS.some((k) => n === normalizeJournalName(k));
}

/**
 * 影响因子匹配：先查数据库 JournalIf 表，再查本地 JSON 映射表。
 * 新手解释：IF = 期刊影响力分数，越高代表期刊越权威。
 */
export async function resolveImpactFactor(journal: string): Promise<number> {
  loadLocal();
  const norm = normalizeJournalName(journal);

  const dbHit = await prisma.journalIf.findFirst({
    where: {
      journalName: { equals: norm, mode: "insensitive" },
    },
  });
  if (dbHit) return dbHit.impactFactor;

  if (localMap.has(norm)) return localMap.get(norm)!.impactFactor;

  if (isTopJournalName(journal)) return 20;
  return 0;
}

export async function seedJournalTable(): Promise<number> {
  loadLocal();
  let count = 0;
  for (const j of journalData as JournalRecord[]) {
    await prisma.journalIf.upsert({
      where: { journalName: j.journalName },
      create: {
        journalName: j.journalName,
        issn: j.issn ?? null,
        impactFactor: j.impactFactor,
        isTopJournal: j.isTopJournal,
      },
      update: {
        impactFactor: j.impactFactor,
        isTopJournal: j.isTopJournal,
      },
    });
    count++;
  }
  return count;
}

export function passesIfFilter(impactFactor: number): boolean {
  return impactFactor > 15;
}

export function passesCoreIfFilter(impactFactor: number): boolean {
  return impactFactor >= 15;
}
