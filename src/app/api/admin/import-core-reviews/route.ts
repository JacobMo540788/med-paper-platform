import { NextRequest, NextResponse } from "next/server";
import type { Specialty } from "@prisma/client";
import { classifyStudyType } from "@/lib/classifier";
import { SPECIALTY_CONFIG } from "@/lib/constants";
import { fetchPubMedReviewLibrary } from "@/lib/fetchers/pubmed";
import { resolveImpactFactor } from "@/lib/journal-if";
import { upsertArticleRecord } from "@/lib/pipeline/article-upsert";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = req.headers.get("authorization");
  const legacySecret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");

  return authorization === `Bearer ${cronSecret}` || legacySecret === cronSecret;
}

function specialtyFromParam(value: string | null): Specialty | null {
  if (!value) return null;
  return Object.keys(SPECIALTY_CONFIG).includes(value) ? (value as Specialty) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const specialty = specialtyFromParam(req.nextUrl.searchParams.get("specialty"));
    if (!specialty) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid specialty." },
        { status: 400 }
      );
    }

    const max = Math.min(parseInt(req.nextUrl.searchParams.get("max") ?? "80", 10), 120);
    const retstart = Math.max(parseInt(req.nextUrl.searchParams.get("retstart") ?? "0", 10), 0);
    const candidates = await fetchPubMedReviewLibrary(specialty, 10, max, retstart);
    let accepted = 0;
    let rejected = 0;
    let belowIf = 0;
    const errors: string[] = [];

    for (const paper of candidates) {
      const impactFactor = await resolveImpactFactor(paper.journal);
      if (impactFactor < 15) {
        belowIf++;
        continue;
      }

      const withReviewType = {
        ...paper,
        articleType: paper.articleType ? `${paper.articleType}; Review` : "Review",
      };
      try {
        const articleId = await upsertArticleRecord(
          withReviewType,
          impactFactor,
          classifyStudyType(withReviewType),
          { asCoreLibrary: true, runLlm: false }
        );

        if (articleId) accepted++;
        else rejected++;
      } catch (e) {
        rejected++;
        errors.push(`${paper.pmid ?? paper.doi ?? paper.titleEn}: ${e instanceof Error ? e.message : String(e)}`);
      }

      await sleep(450);
    }

    return NextResponse.json({
      success: true,
      specialty,
      retstart,
      max,
      fetched: candidates.length,
      accepted,
      rejected,
      belowIf,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
