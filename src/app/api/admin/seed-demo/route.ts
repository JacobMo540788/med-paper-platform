import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBeijingDateKey } from "@/lib/beijing-time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = req.headers.get("authorization");
  const legacySecret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");

  return authorization === `Bearer ${cronSecret}` || legacySecret === cronSecret;
}

function pubDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

const demoArticles = [
  {
    titleEn:
      "Single-cell atlas reveals immune evasion mechanisms in colorectal cancer microenvironment",
    titleCn: "单细胞图谱揭示结直肠癌微环境中的免疫逃逸机制",
    abstract:
      "Using single-cell RNA sequencing of tumor and adjacent tissues, researchers mapped immune and stromal cell states and identified fibroblast-driven immune suppression.",
    abstractCn:
      "研究通过单细胞 RNA 测序描绘肿瘤及癌旁组织的细胞生态，发现成纤维细胞相关的免疫抑制机制。",
    journal: "Nature",
    impactFactor: 64.8,
    doi: "10.1038/demo-crc-001",
    pmid: "demo-pmid-001",
    authors: ["Zhang L", "Wang Y", "Chen H"],
    publishDate: pubDate(2024, 3, 15),
    specialty: "ONCOLOGY_COLORECTAL" as const,
    studyType: "BASIC" as const,
    keywords: ["colorectal cancer", "single-cell", "tumor microenvironment"],
    aiSummary:
      "这篇研究展示了单细胞技术如何帮助理解结直肠癌免疫逃逸，并提示潜在联合治疗靶点。",
    isLandmark: true,
    isCoreLibrary: true,
  },
  {
    titleEn: "Phase III trial of neoadjuvant immunotherapy in locally advanced rectal cancer",
    titleCn: "局部晚期直肠癌新辅助免疫治疗 III 期临床试验",
    abstract:
      "A randomized phase III trial evaluated PD-1 blockade combined with chemoradiotherapy before surgery in locally advanced rectal cancer.",
    abstractCn:
      "一项随机 III 期试验评估 PD-1 阻断联合放化疗用于局部晚期直肠癌术前治疗的疗效和安全性。",
    journal: "New England Journal of Medicine",
    impactFactor: 176.0,
    doi: "10.1056/demo-crc-002",
    pmid: "demo-pmid-002",
    authors: ["Liu M", "Smith J"],
    publishDate: pubDate(2023, 11, 8),
    specialty: "ONCOLOGY_COLORECTAL" as const,
    studyType: "CLINICAL" as const,
    keywords: ["rectal cancer", "immunotherapy", "clinical trial"],
    aiSummary:
      "该试验提示新辅助免疫治疗联合标准治疗可能提高病理完全缓解率，具有重要临床意义。",
    isLandmark: false,
    isCoreLibrary: true,
  },
  {
    titleEn: "CRISPR-based gene therapy restores vision in inherited retinal degeneration",
    titleCn: "基于 CRISPR 的基因治疗改善遗传性视网膜变性患者视功能",
    abstract:
      "In vivo CRISPR editing was evaluated in patients with inherited retinal degeneration, with early evidence of visual function improvement.",
    abstractCn:
      "研究评估体内 CRISPR 编辑治疗遗传性视网膜变性的安全性和初步疗效，并观察到视功能改善信号。",
    journal: "Nature Medicine",
    impactFactor: 82.9,
    doi: "10.1038/demo-eye-001",
    pmid: "demo-pmid-003",
    authors: ["Brown A", "Lee K"],
    publishDate: pubDate(2022, 6, 20),
    specialty: "OPHTHALMOLOGY" as const,
    studyType: "CLINICAL" as const,
    keywords: ["CRISPR", "gene therapy", "retina"],
    aiSummary:
      "这项研究展示了体内基因编辑在遗传性眼病中的转化潜力，是眼科前沿研究的重要方向。",
    isLandmark: true,
    isCoreLibrary: true,
  },
];

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const featuredDateKey = getBeijingDateKey();
  const now = new Date();

  for (const article of demoArticles) {
    await prisma.article.upsert({
      where: { doi: article.doi },
      create: {
        ...article,
        featuredDateKey,
        isTodayPick: true,
        isInHistory: false,
        source: "SEED",
        coreAddedAt: article.isCoreLibrary ? now : null,
        aiAnalysisJson: {
          goal: "帮助演示医学前沿论文平台的文章详情、AI 摘要和学科分类功能。",
          conclusion: article.aiSummary,
          methods: "演示数据，用于验证部署后的页面、数据库和 API 是否正常。",
          design: ["Demo article", "Production smoke test"],
          technologies: article.keywords,
          clinical_significance: article.aiSummary,
          keywords_cn_en: article.keywords.map((keyword) => ({ en: keyword, cn: keyword })),
        },
        keywordsBilingual: article.keywords.map((keyword) => ({ en: keyword, cn: keyword })),
      },
      update: {
        ...article,
        featuredDateKey,
        isTodayPick: true,
        isInHistory: false,
        aiAnalysisJson: {
          goal: "帮助演示医学前沿论文平台的文章详情、AI 摘要和学科分类功能。",
          conclusion: article.aiSummary,
          methods: "演示数据，用于验证部署后的页面、数据库和 API 是否正常。",
          design: ["Demo article", "Production smoke test"],
          technologies: article.keywords,
          clinical_significance: article.aiSummary,
          keywords_cn_en: article.keywords.map((keyword) => ({ en: keyword, cn: keyword })),
        },
        keywordsBilingual: article.keywords.map((keyword) => ({ en: keyword, cn: keyword })),
        coreAddedAt: article.isCoreLibrary ? now : undefined,
      },
    });
  }

  return NextResponse.json({ success: true, insertedOrUpdated: demoArticles.length });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
