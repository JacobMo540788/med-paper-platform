import assert from "node:assert/strict";
import { PIPELINE_STATUS, RESOURCE_KIND, WEEKLY_UPDATE_CRON_UTC, UROLOGY_SPECIALTY } from "../src/lib/constants";
import { rollingWindowStart } from "../src/lib/urology-resources";
import { decidePipelineStatus } from "../src/lib/pipeline/urology-rules";
import type { RawPaper } from "../src/lib/types";

function paper(overrides: Partial<RawPaper> = {}): RawPaper {
  return {
    titleEn: "Randomized trial of prostate cancer treatment with survival outcomes",
    abstract: "Patients with prostate cancer were enrolled in a clinical trial with overall survival outcomes.",
    journal: "European Urology",
    doi: "10.1000/example",
    pmid: "123456",
    authors: ["Smith J"],
    publishDate: new Date("2025-01-01"),
    keywords: ["Prostatic Neoplasms", "Humans"],
    articleType: "Journal Article",
    sourceProvider: "pubmed",
    specialty: UROLOGY_SPECIALTY,
    ...overrides,
  };
}

assert.equal(WEEKLY_UPDATE_CRON_UTC, "0 18 * * 6", "weekly cron must run Sunday 02:00 Beijing time");

const reference = new Date("2026-07-21T12:00:00Z");
assert.equal(rollingWindowStart(reference).toISOString().slice(0, 10), "2021-07-21");

assert.equal(
  decidePipelineStatus({
    paper: paper(),
    resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
    impactFactor: 10,
    jifStatus: "VERIFIED",
    metadataVerified: true,
  }).status,
  PIPELINE_STATUS.PUBLISHED
);

assert.equal(
  decidePipelineStatus({
    paper: paper(),
    resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
    impactFactor: 9.999,
    jifStatus: "VERIFIED",
    metadataVerified: true,
  }).status,
  PIPELINE_STATUS.MANUAL_REVIEW
);

assert.equal(
  decidePipelineStatus({
    paper: paper(),
    resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
    impactFactor: 0,
    jifStatus: "PENDING",
    metadataVerified: true,
  }).status,
  PIPELINE_STATUS.MANUAL_REVIEW
);

assert.equal(
  decidePipelineStatus({
    paper: paper({ articleType: "Case Reports" }),
    resourceKind: RESOURCE_KIND.CLINICAL_RESEARCH,
    impactFactor: 20,
    jifStatus: "VERIFIED",
    metadataVerified: true,
  }).status,
  PIPELINE_STATUS.MANUAL_REVIEW
);

assert.equal(
  decidePipelineStatus({
    paper: paper({
      titleEn: "Guideline for canine urinary tract disease",
      abstract: "Veterinary recommendations for dogs with urinary tract disease.",
      articleType: "Guideline",
      keywords: ["Dogs"],
    }),
    resourceKind: RESOURCE_KIND.GUIDELINE,
    impactFactor: 0,
    jifStatus: "NOT_APPLICABLE",
    metadataVerified: true,
  }).status,
  PIPELINE_STATUS.REJECTED
);

console.log("[test-harvest-pipeline] all checks passed");
