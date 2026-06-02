/**
 * 演示种子数据
 * 运行：npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { getBeijingDateKey } from "../src/lib/beijing-time";
import { seedJournalTable } from "../src/lib/journal-if";

const prisma = new PrismaClient();
const todayKey = getBeijingDateKey();

function pubDate(y: number, m: number, d: number) {
  return new Date(y, m - 1, d);
}

const DEMO_ARTICLES = [
  {
    titleEn:
      "Single-cell atlas reveals immune evasion mechanisms in colorectal cancer microenvironment",
    titleCn: "单细胞图谱揭示结直肠癌微环境中免疫逃逸机制",
    abstract:
      "Colorectal cancer (CRC) remains a leading cause of cancer mortality. Using single-cell RNA sequencing of tumor and adjacent normal tissues from 48 patients, we mapped the cellular ecosystem and identified a cancer-associated fibroblast subset driving immunosuppression via CXCL12-CXCR4 signaling.",
    abstractCn:
      "结直肠癌仍是主要癌症死因之一。本研究对48例患者肿瘤及癌旁组织进行单细胞RNA测序，绘制细胞生态系统图谱，发现一类通过CXCL12-CXCR4信号促进免疫抑制的癌症相关成纤维细胞亚群。",
    journal: "Nature",
    impactFactor: 64.8,
    doi: "10.1038/demo-crc-001",
    pmid: "demo-pmid-001",
    authors: ["Zhang L", "Wang Y", "Chen H"],
    publishDate: pubDate(2024, 3, 15),
    specialty: "ONCOLOGY_COLORECTAL" as const,
    studyType: "BASIC" as const,
    keywords: ["colorectal cancer", "single-cell", "tumor microenvironment"],
    aiSummary: "本研究旨在揭示结直肠癌肿瘤微环境中免疫逃逸的新机制。",
    aiAnalysisJson: {
      goal: "本研究旨在揭示结直肠癌肿瘤微环境中免疫逃逸的新机制。",
      conclusion: "研究发现 CAF 亚群通过 CXCL12 信号促进免疫抑制。",
      methods: "采用单细胞测序结合空间转录组技术分析患者样本。",
      design: ["患者样本队列", "单细胞测序", "功能验证实验"],
      technologies: ["scRNA-seq", "Spatial Transcriptomics", "Flow Cytometry"],
      clinical_significance: "该研究可能为免疫治疗联合靶向治疗提供新策略。",
      keywords_cn_en: [
        { en: "Tumor Microenvironment", cn: "肿瘤微环境" },
        { en: "Colorectal Cancer", cn: "结直肠癌" },
      ],
      flowchart_mermaid: `flowchart TD
  A["结直肠癌免疫逃逸科学问题"] --> B["48例患者肿瘤/癌旁组织"]
  B --> C["单细胞RNA测序建库测序"]
  C --> D["细胞类型注释与亚群鉴定"]
  D --> E["CAF亚群差异分析"]
  E --> F["CXCL12-CXCR4通路验证"]
  F --> G["功能实验: 免疫抑制表型"]
  G --> H["揭示CAF驱动免疫逃逸机制"]`,
    },
    isLandmark: true,
    isTodayPick: true,
    featuredDateKey: todayKey,
    isCoreLibrary: true,
  },
  {
    titleEn: "Phase III trial of neoadjuvant immunotherapy in locally advanced rectal cancer",
    titleCn: "局部晚期直肠癌新辅助免疫治疗 III 期临床试验",
    abstract:
      "A randomized phase III trial evaluating neoadjuvant PD-1 blockade combined with chemoradiotherapy in locally advanced rectal cancer.",
    abstractCn: "一项评估 PD-1 阻断联合放化疗用于局部晚期直肠癌新辅助治疗的随机 III 期试验。",
    journal: "New England Journal of Medicine",
    impactFactor: 176.0,
    doi: "10.1056/demo-crc-002",
    pmid: "demo-pmid-002",
    authors: ["Liu M", "Smith J"],
    publishDate: pubDate(2023, 11, 8),
    specialty: "ONCOLOGY_COLORECTAL" as const,
    studyType: "CLINICAL" as const,
    keywords: ["rectal cancer", "immunotherapy", "clinical trial"],
    aiSummary: "评估新辅助免疫联合放化疗在局部晚期直肠癌中的疗效与安全性。",
    aiAnalysisJson: {
      goal: "评估新辅助免疫治疗在局部晚期直肠癌中的疗效。",
      conclusion: "联合治疗显著提高病理完全缓解率。",
      methods: "多中心随机对照 III 期临床试验。",
      design: ["患者随机分组", "新辅助治疗", "手术与随访"],
      technologies: ["PD-1 inhibitor", "Chemoradiotherapy"],
      clinical_significance: "有望改变局部晚期直肠癌的标准治疗路径。",
      keywords_cn_en: [{ en: "Neoadjuvant Therapy", cn: "新辅助治疗" }],
      flowchart_mermaid: `flowchart TD
  A["局部晚期直肠癌未满足治疗需求"] --> B["多中心患者筛选入组"]
  B --> C["随机分组"]
  C --> D1["新辅助 PD-1 + 放化疗"]
  C --> D2["标准新辅助放化疗对照"]
  D1 --> E["手术切除与病理评估"]
  D2 --> E
  E --> F["pCR/DFS 等主要终点分析"]
  F --> G["联合方案提高病理完全缓解率"]`,
    },
    isTodayPick: true,
    featuredDateKey: todayKey,
    isCoreLibrary: true,
  },
  {
    titleEn: "CRISPR-based gene therapy restores vision in inherited retinal degeneration",
    titleCn: "基于 CRISPR 的基因治疗恢复遗传性视网膜变性患者视力",
    abstract: "In vivo CRISPR editing of RPE65 in patients with Leber congenital amaurosis.",
    abstractCn: "在 Leber 先天性黑矇患者中进行 RPE65 体内 CRISPR 编辑。",
    journal: "Nature Medicine",
    impactFactor: 82.9,
    doi: "10.1038/demo-eye-001",
    pmid: "demo-pmid-003",
    authors: ["Brown A", "Lee K"],
    publishDate: pubDate(2022, 6, 20),
    specialty: "OPHTHALMOLOGY" as const,
    studyType: "CLINICAL" as const,
    keywords: ["CRISPR", "gene therapy", "retina"],
    aiSummary: "探索 CRISPR 体内编辑治疗遗传性眼病的临床可行性。",
    aiAnalysisJson: {
      goal: "评估 CRISPR 基因治疗在遗传性视网膜变性中的安全性与疗效。",
      conclusion: "治疗组视力指标显著改善，安全性可控。",
      methods: "开放标签临床试验，随访52周。",
      design: ["患者入组", "单次给药", "视力功能评估"],
      technologies: ["CRISPR", "AAV vector"],
      clinical_significance: "为遗传性眼病基因治疗提供重要临床证据。",
      keywords_cn_en: [{ en: "Gene Therapy", cn: "基因治疗" }],
      flowchart_mermaid: `flowchart TD
  A["遗传性视网膜变性治疗空白"] --> B["LCA患者筛选与基线评估"]
  B --> C["AAV载体递送 CRISPR 编辑 RPE65"]
  C --> D["术后安全性监测"]
  D --> E["视力与视网膜功能随访52周"]
  E --> F["亚组分析与生物标志物"]
  F --> G["基因治疗显著改善视力"]`,
    },
    isTodayPick: true,
    featuredDateKey: todayKey,
    isCoreLibrary: true,
  },
  /** 历史库示例：昨日归档 */
  {
    titleEn: "Landmark immunotherapy biomarkers in colorectal cancer (archived demo)",
    titleCn: "结直肠癌免疫治疗生物标志物经典研究（历史库示例）",
    abstract: "Archived demonstration article for specialty history library.",
    abstractCn: "用于演示历史文献库归档功能的示例论文。",
    journal: "Lancet",
    impactFactor: 168.9,
    doi: "10.1016/demo-history-001",
    pmid: "demo-pmid-hist-001",
    authors: ["Demo Author"],
    publishDate: pubDate(2021, 5, 10),
    specialty: "ONCOLOGY_COLORECTAL" as const,
    studyType: "CLINICAL" as const,
    keywords: ["biomarker", "immunotherapy"],
    aiSummary: "历史库示例：免疫治疗生物标志物研究。",
    aiAnalysisJson: {
      goal: "探索免疫治疗疗效预测标志物。",
      conclusion: "特定分子标志物与疗效相关。",
      methods: "回顾性队列研究。",
      design: ["队列构建", "标志物检测"],
      technologies: ["IHC", "NGS"],
      clinical_significance: "支持个体化免疫治疗决策。",
      keywords_cn_en: [{ en: "Biomarker", cn: "生物标志物" }],
    },
    isTodayPick: false,
    isInHistory: true,
    archivedAt: new Date(),
    featuredDateKey: "2020-01-01",
    isCoreLibrary: true,
  },
];

async function main() {
  console.log("Seeding journals...");
  await seedJournalTable();

  console.log("Seeding demo articles...");
  for (const a of DEMO_ARTICLES) {
    const { aiAnalysisJson, ...rest } = a;
    await prisma.article.upsert({
      where: { doi: a.doi },
      create: {
        ...rest,
        keywordsBilingual: aiAnalysisJson.keywords_cn_en,
        aiAnalysisJson,
        source: "SEED",
        coreAddedAt: a.isCoreLibrary ? new Date() : null,
      },
      update: {
        ...rest,
        aiAnalysisJson,
        keywordsBilingual: aiAnalysisJson.keywords_cn_en,
        coreAddedAt: a.isCoreLibrary ? new Date() : undefined,
      },
    });
  }

  console.log(`Done. Seeded ${DEMO_ARTICLES.length} demo articles (todayKey=${todayKey}).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
