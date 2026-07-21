import journalData from "../../data/journal-impact-factors.json";
import { prisma } from "./db";
import { RESEARCH_MIN_JIF, TOP_JOURNAL_KEYWORDS } from "./constants";

export interface JournalRecord {
  journalName: string;
  issn?: string;
  eIssn?: string;
  aliases?: string[];
  impactFactor: number;
  isTopJournal: boolean;
  jifYear?: number;
  source?: string;
  verifiedAt?: string;
}

export interface JournalIfResolution {
  impactFactor: number | null;
  status: "VERIFIED" | "PENDING" | "NOT_APPLICABLE";
  jifYear?: number | null;
  source?: string | null;
  matchedBy?: "issn" | "eIssn" | "journalName" | "alias" | "local";
}

const localMap = new Map<string, JournalRecord>();
const issnMap = new Map<string, JournalRecord>();
const JOURNAL_ALIASES: Record<string, string> = {
  "n engl j med": "new england journal of medicine",
  "the new england journal of medicine": "new england journal of medicine",
  "new engl j med": "new england journal of medicine",
  "the lancet": "lancet",
};

export function normalizeJournalName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[.:,;]+$/g, "").replace(/\s+/g, " ");
  return JOURNAL_ALIASES[normalized] ?? normalized;
}

function normalizeIssn(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[^0-9X]/g, "") ?? "";
}

function loadLocal(): void {
  if (localMap.size > 0) return;
  for (const record of journalData as JournalRecord[]) {
    const normalized = normalizeJournalName(record.journalName);
    localMap.set(normalized, record);
    for (const alias of record.aliases ?? []) localMap.set(normalizeJournalName(alias), record);
    const issn = normalizeIssn(record.issn);
    const eIssn = normalizeIssn(record.eIssn);
    if (issn) issnMap.set(issn, record);
    if (eIssn) issnMap.set(eIssn, record);
  }
}

export function isTopJournalName(journal: string): boolean {
  const n = normalizeJournalName(journal);
  return TOP_JOURNAL_KEYWORDS.some((k) => n === normalizeJournalName(k));
}

export async function resolveJournalImpactFactor(
  journal: string,
  issn?: string | null
): Promise<JournalIfResolution> {
  const norm = normalizeJournalName(journal);
  const issnNorm = normalizeIssn(issn);

  const dbHit = await prisma.journalIf.findFirst({
    where: {
      OR: [
        ...(issnNorm ? [{ issn: { equals: issnNorm, mode: "insensitive" as const } }] : []),
        ...(issnNorm ? [{ eIssn: { equals: issnNorm, mode: "insensitive" as const } }] : []),
        { normalizedName: { equals: norm, mode: "insensitive" } },
        { journalName: { equals: journal, mode: "insensitive" } },
        { journalName: { equals: norm, mode: "insensitive" } },
        { aliases: { has: journal } },
        { aliases: { has: norm } },
      ],
    },
    orderBy: [{ jifYear: "desc" }, { verifiedAt: "desc" }],
  });

  if (dbHit?.source && dbHit.verifiedAt && dbHit.impactFactor > 0) {
    return {
      impactFactor: dbHit.impactFactor,
      status: "VERIFIED",
      jifYear: dbHit.jifYear ?? null,
      source: dbHit.source,
      matchedBy: dbHit.issn && normalizeIssn(dbHit.issn) === issnNorm ? "issn" : "journalName",
    };
  }

  loadLocal();
  const local = (issnNorm && issnMap.get(issnNorm)) || localMap.get(norm);
  if (local?.impactFactor && local.source && local.verifiedAt) {
    return {
      impactFactor: local.impactFactor,
      status: "VERIFIED",
      jifYear: local.jifYear ?? null,
      source: local.source,
      matchedBy: issnNorm && issnMap.get(issnNorm) ? "issn" : "local",
    };
  }

  return { impactFactor: null, status: "PENDING", jifYear: null, source: null };
}

export async function resolveImpactFactor(journal: string): Promise<number> {
  const resolved = await resolveJournalImpactFactor(journal);
  return resolved.status === "VERIFIED" && resolved.impactFactor != null ? resolved.impactFactor : 0;
}

export async function seedJournalTable(): Promise<number> {
  loadLocal();
  let count = 0;
  const fallbackYear = new Date().getFullYear() - 1;
  for (const j of journalData as JournalRecord[]) {
    await prisma.journalIf.upsert({
      where: { journalName: j.journalName },
      create: {
        journalName: j.journalName,
        normalizedName: normalizeJournalName(j.journalName),
        issn: j.issn ? normalizeIssn(j.issn) : null,
        eIssn: j.eIssn ? normalizeIssn(j.eIssn) : null,
        aliases: j.aliases ?? [],
        impactFactor: j.impactFactor,
        isTopJournal: j.isTopJournal,
        jifYear: j.jifYear ?? fallbackYear,
        source: j.source ?? "local manual JIF whitelist",
        verifiedAt: j.verifiedAt ? new Date(j.verifiedAt) : new Date(),
      },
      update: {
        normalizedName: normalizeJournalName(j.journalName),
        issn: j.issn ? normalizeIssn(j.issn) : null,
        eIssn: j.eIssn ? normalizeIssn(j.eIssn) : null,
        aliases: j.aliases ?? [],
        impactFactor: j.impactFactor,
        isTopJournal: j.isTopJournal,
        jifYear: j.jifYear ?? fallbackYear,
        source: j.source ?? "local manual JIF whitelist",
        verifiedAt: j.verifiedAt ? new Date(j.verifiedAt) : new Date(),
      },
    });
    count++;
  }
  return count;
}

export function passesIfFilter(impactFactor: number | null | undefined): boolean {
  return typeof impactFactor === "number" && impactFactor >= RESEARCH_MIN_JIF;
}

export function passesCoreIfFilter(impactFactor: number | null | undefined): boolean {
  return passesIfFilter(impactFactor);
}
