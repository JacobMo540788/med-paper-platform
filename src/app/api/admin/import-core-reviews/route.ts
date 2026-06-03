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

export async function POST(req: NextRequest) {
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

  const candidates = await fetchPubMedReviewLibrary(specialty, 10, 120);
  let accepted = 0;
  let rejected = 0;
  let belowIf = 0;

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
    const articleId = await upsertArticleRecord(
      withReviewType,
      impactFactor,
      classifyStudyType(withReviewType),
      { asCoreLibrary: true, runLlm: false }
    );

    if (articleId) accepted++;
    else rejected++;
  }

  return NextResponse.json({
    success: true,
    specialty,
    fetched: candidates.length,
    accepted,
    rejected,
    belowIf,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
