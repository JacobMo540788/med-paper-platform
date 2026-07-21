import { prisma } from "../db";
import { WEEKLY_OVERLAP_DAYS } from "../constants";
import { Prisma } from "@prisma/client";

export interface HarvestWindow {
  fromDate: Date;
  toDate: Date;
}

export function weeklyRunKey(reference = new Date()) {
  const date = reference.toISOString().slice(0, 10);
  return `urology-weekly-${date}`;
}

export async function getIncrementalWindow(reference = new Date()): Promise<HarvestWindow> {
  const latest = await prisma.harvestRun.findFirst({
    where: { mode: "weekly", status: "SUCCESS", endedAt: { not: null } },
    orderBy: { endedAt: "desc" },
    select: { endedAt: true },
  });
  const fromDate = latest?.endedAt ? new Date(latest.endedAt) : new Date(reference);
  fromDate.setDate(fromDate.getDate() - WEEKLY_OVERLAP_DAYS);
  fromDate.setHours(0, 0, 0, 0);
  return { fromDate, toDate: reference };
}

export async function withJobLock<T>(
  key: string,
  ttlMs: number,
  task: (owner: string) => Promise<T>
): Promise<T | { skipped: true; reason: string }> {
  const now = new Date();
  const owner = `${process.env.NETLIFY_BUILD_ID ?? "local"}-${process.pid}-${Date.now()}`;
  const lockedUntil = new Date(now.getTime() + ttlMs);

  const acquired = await prisma.$transaction(async (tx) => {
    const current = await tx.jobLock.findUnique({ where: { key } });
    if (current && current.lockedUntil > now && current.owner !== owner) return false;
    await tx.jobLock.upsert({
      where: { key },
      create: { key, owner, lockedUntil },
      update: { owner, lockedUntil },
    });
    return true;
  });

  if (!acquired) return { skipped: true, reason: `Job ${key} is already running.` };

  try {
    return await task(owner);
  } finally {
    await prisma.jobLock.updateMany({
      where: { key, owner },
      data: { lockedUntil: new Date(0) },
    });
  }
}

export async function startHarvestRun(input: {
  runKey: string;
  mode: string;
  fromDate?: Date;
  toDate?: Date;
}) {
  return prisma.harvestRun.upsert({
    where: { runKey: input.runKey },
    create: {
      runKey: input.runKey,
      mode: input.mode,
      status: "RUNNING",
      fromDate: input.fromDate,
      toDate: input.toDate,
    },
    update: {
      status: "RUNNING",
      startedAt: new Date(),
      endedAt: null,
      fromDate: input.fromDate,
      toDate: input.toDate,
      errors: null,
    },
  });
}

export async function finishHarvestRun(
  runKey: string,
  status: "SUCCESS" | "FAILED",
  report: {
    totalHits?: number;
    discovered?: number;
    dedupedCandidates?: number;
    metadataVerified?: number;
    contentReviewed?: number;
    jifVerified?: number;
    published?: number;
    manualReview?: number;
    rejected?: number;
    sourceErrors?: number;
    report?: Prisma.InputJsonValue;
    errors?: string[];
  }
) {
  const jsonReport =
    report.report == null ? Prisma.JsonNull : (report.report as Prisma.InputJsonValue);
  return prisma.harvestRun.update({
    where: { runKey },
    data: {
      status,
      endedAt: new Date(),
      totalHits: report.totalHits ?? 0,
      discovered: report.discovered ?? 0,
      dedupedCandidates: report.dedupedCandidates ?? 0,
      metadataVerified: report.metadataVerified ?? 0,
      contentReviewed: report.contentReviewed ?? 0,
      jifVerified: report.jifVerified ?? 0,
      published: report.published ?? 0,
      manualReview: report.manualReview ?? 0,
      rejected: report.rejected ?? 0,
      sourceErrors: report.sourceErrors ?? 0,
      report: jsonReport,
      errors: report.errors?.join("\n") ?? null,
    },
  });
}
