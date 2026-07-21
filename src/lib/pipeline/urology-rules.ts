import { PIPELINE_STATUS, RESOURCE_KIND, RESEARCH_MIN_JIF, type PipelineStatus, type ResourceKind } from "../constants";
import type { RawPaper } from "../types";

const EXCLUDED_TYPE_RE =
  /\b(editorial|comment|letter|news|erratum|correction|case reports?|congress|conference abstract|study protocol)\b/i;
const VETERINARY_RE = /\b(veterinary|feline|canine|cat|dog|horse|bovine|equine)\b/i;
const HUMAN_RE = /\b(human|humans|patient|patients|men|women|adult|child|children|adolescent|clinical|trial|cohort)\b/i;
const BASIC_RE =
  /\b(mechanism|molecular|cell line|in vitro|in vivo|mouse|mice|organoid|single-cell|transcriptom|proteom|metabolom|microenvironment|preclinical|biomaterial|xenograft|knockdown|knockout|crispr|pathway|signaling|signalling)\b/i;
const CLINICAL_OUTCOME_RE =
  /\b(patient|patients|survival|efficacy|safety|outcome|diagnosis|prognosis|treatment|therapy|trial|cohort|meta-analysis|systematic review|real-world)\b/i;
const UROLOGY_RE =
  /\b(urology|urologic|urological|prostate|prostatic|bladder|urothelial|renal cell carcinoma|kidney cancer|renal cancer|upper tract|testicular|penile|urolithiasis|urinary tract infection|urinary incontinence|neuro-urology|neurogenic bladder|male infertility|erectile dysfunction|urethral|ureteral|cystectomy|prostatectomy|nephrectomy|pyelonephritis|cystitis)\b/i;

export interface RuleDecision {
  status: PipelineStatus;
  exclusionReasons: string[];
  canPublish: boolean;
}

function haystack(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  return [paper.titleEn, paper.abstract ?? "", paper.articleType ?? "", ...(paper.keywords ?? [])].join(" ");
}

export function hasExcludedPublicationType(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  return EXCLUDED_TYPE_RE.test(haystack(paper));
}

export function isUrologyRelevant(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  return UROLOGY_RE.test(haystack(paper));
}

export function isVeterinaryOrNonHumanGuideline(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  const text = haystack(paper);
  return VETERINARY_RE.test(text) && !HUMAN_RE.test(text);
}

export function hasClinicalOutcome(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  return CLINICAL_OUTCOME_RE.test(haystack(paper));
}

export function hasBasicEvidence(paper: Pick<RawPaper, "titleEn" | "abstract" | "keywords" | "articleType">) {
  return BASIC_RE.test(haystack(paper));
}

export function decidePipelineStatus(input: {
  paper: RawPaper;
  resourceKind: ResourceKind;
  impactFactor: number;
  jifStatus: string;
  metadataVerified: boolean;
  aiAccepted?: boolean;
  aiRequired?: boolean;
}): RuleDecision {
  const reasons: string[] = [];
  const { paper, resourceKind, impactFactor, jifStatus, metadataVerified } = input;

  if (!metadataVerified) reasons.push("metadata_not_verified");
  if (!isUrologyRelevant(paper)) reasons.push("not_urology_relevant");

  if (resourceKind === RESOURCE_KIND.GUIDELINE) {
    if (isVeterinaryOrNonHumanGuideline(paper)) reasons.push("veterinary_or_non_human_guideline");
    const guidelineLike = /\b(guideline|practice guideline|consensus|recommendation|position statement)\b/i.test(haystack(paper));
    if (!guidelineLike) reasons.push("not_formal_guideline_record");
  } else {
    if (hasExcludedPublicationType(paper)) reasons.push("excluded_publication_type");
    if (jifStatus !== "VERIFIED") reasons.push("jif_not_verified");
    if (impactFactor < RESEARCH_MIN_JIF) reasons.push("jif_below_threshold");
    if (resourceKind === RESOURCE_KIND.CLINICAL_RESEARCH && !hasClinicalOutcome(paper)) {
      reasons.push("no_clear_clinical_outcome");
    }
    if (resourceKind === RESOURCE_KIND.BASIC_RESEARCH && !hasBasicEvidence(paper)) {
      reasons.push("no_basic_or_preclinical_evidence");
    }
  }

  if (input.aiRequired && !input.aiAccepted) reasons.push("ai_content_review_not_accepted");

  if (reasons.includes("metadata_not_verified")) {
    return { status: PIPELINE_STATUS.SOURCE_ERROR, exclusionReasons: reasons, canPublish: false };
  }
  if (reasons.includes("not_urology_relevant") || reasons.includes("veterinary_or_non_human_guideline")) {
    return { status: PIPELINE_STATUS.REJECTED, exclusionReasons: reasons, canPublish: false };
  }
  if (reasons.length) {
    return { status: PIPELINE_STATUS.MANUAL_REVIEW, exclusionReasons: reasons, canPublish: false };
  }
  return { status: PIPELINE_STATUS.PUBLISHED, exclusionReasons: [], canPublish: true };
}
