import type { Specialty, StudyType } from "@prisma/client";
import type { RawPaper } from "./types";

const CLINICAL_KEYWORDS = [
  "clinical trial",
  "randomized",
  "randomised",
  "cohort",
  "patients",
  "patient",
  "prospective",
  "retrospective",
  "phase i",
  "phase ii",
  "phase iii",
  "multicenter",
  "multicentre",
  "survival",
  "efficacy",
  "safety",
  "adverse event",
];

const BASIC_KEYWORDS = [
  "in vitro",
  "in vivo",
  "mouse",
  "mice",
  "knockout",
  "knockdown",
  "crispr",
  "sequencing",
  "transcriptom",
  "proteom",
  "organoid",
  "cell line",
  "mechanism",
  "pathway",
  "signaling",
  "signalling",
];

/**
 * 研究类型分类：先用关键词规则，简单可靠；复杂情况可由 LLM 二次校正。
 */
export function classifyStudyType(paper: RawPaper): StudyType {
  const text = [
    paper.titleEn,
    paper.abstract ?? "",
    paper.articleType ?? "",
    ...paper.keywords,
  ]
    .join(" ")
    .toLowerCase();

  let clinicalScore = 0;
  let basicScore = 0;

  for (const kw of CLINICAL_KEYWORDS) {
    if (text.includes(kw)) clinicalScore++;
  }
  for (const kw of BASIC_KEYWORDS) {
    if (text.includes(kw)) basicScore++;
  }

  if (clinicalScore > basicScore) return "CLINICAL";
  if (basicScore > clinicalScore) return "BASIC";
  return text.includes("trial") || text.includes("patient") ? "CLINICAL" : "BASIC";
}

export function inferColorectalFocus(paper: RawPaper): boolean {
  const text = `${paper.titleEn} ${paper.abstract ?? ""}`.toLowerCase();
  return (
    text.includes("colorectal") ||
    text.includes("colon cancer") ||
    text.includes("rectal cancer") ||
    text.includes("crc")
  );
}

export function refineSpecialty(paper: RawPaper): Specialty {
  if (paper.specialty === "ONCOLOGY_COLORECTAL" && !inferColorectalFocus(paper)) {
    return "ONCOLOGY_COLORECTAL";
  }
  return paper.specialty;
}
