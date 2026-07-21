import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  authorSortKey,
  compareResourceCards,
  dedupeKey,
  isVerifiedJifEligible,
  isWithinRollingYears,
  parseResourceSearchParams,
  rollingWindowStart,
} from "../src/lib/urology-resources";
import type { ArticleCardDTO } from "../src/lib/types";

function card(partial: Partial<ArticleCardDTO>): ArticleCardDTO {
  return {
    id: partial.id ?? "id",
    titleEn: partial.titleEn ?? "Title",
    titleCn: partial.titleCn ?? null,
    specialty: "UROLOGY",
    studyType: "CLINICAL",
    impactFactor: partial.impactFactor ?? 10,
    jifStatus: partial.jifStatus ?? "VERIFIED",
    jifYear: partial.jifYear ?? 2024,
    journal: partial.journal ?? "Journal",
    resourceKind: partial.resourceKind ?? "CLINICAL_RESEARCH",
    diseaseArea: partial.diseaseArea ?? "前列腺癌",
    organization: partial.organization ?? null,
    firstAuthor: partial.firstAuthor ?? null,
    doi: partial.doi ?? null,
    pmid: partial.pmid ?? null,
    publishDate: partial.publishDate ?? "2026-01-01T00:00:00.000Z",
    keywords: [],
    aiSummary: partial.aiSummary ?? null,
    articleType: partial.articleType ?? null,
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|md|json)$/.test(name)) out.push(p);
  }
  return out;
}

const ref = new Date("2026-07-20T12:00:00Z");
assert.equal(rollingWindowStart(ref, 5).getFullYear(), 2021);
assert.equal(isWithinRollingYears(new Date(2021, 6, 20, 0, 0, 0), ref, 5), true);
assert.equal(isWithinRollingYears(new Date(2021, 6, 19, 23, 59, 59), ref, 5), false);

assert.equal(isVerifiedJifEligible(9.999, "VERIFIED"), false);
assert.equal(isVerifiedJifEligible(10.0, "VERIFIED"), true);
assert.equal(isVerifiedJifEligible(undefined, "VERIFIED"), false);
assert.equal(isVerifiedJifEligible(15, "PENDING"), false);

const jifSorted = [
  card({ id: "missing", impactFactor: 99, jifStatus: "PENDING", titleEn: "Z" }),
  card({ id: "good", impactFactor: 10, jifStatus: "VERIFIED", titleEn: "A" }),
].sort((a, b) => compareResourceCards(a, b, "jif_desc"));
assert.equal(jifSorted[0].id, "good");

const authorSorted = [
  card({ id: "none", firstAuthor: null, titleEn: "C" }),
  card({ id: "smith", firstAuthor: "John Smith", titleEn: "B" }),
  card({ id: "chen", firstAuthor: "Wei Chen", titleEn: "A" }),
].sort((a, b) => compareResourceCards(a, b, "first_author_asc"));
assert.deepEqual(authorSorted.map((x) => x.id), ["chen", "smith", "none"]);
assert.equal(authorSortKey("John Smith"), "smith john");

const sp = new URLSearchParams("resourceKind=CLINICAL_RESEARCH&diseaseArea=前列腺癌,膀胱癌&year=2025,2026&page=2&sort=jif_desc");
const parsed = parseResourceSearchParams(sp);
assert.equal(parsed.resourceKind, "CLINICAL_RESEARCH");
assert.deepEqual(parsed.diseaseArea, ["前列腺癌", "膀胱癌"]);
assert.deepEqual(parsed.year, [2025, 2026]);
assert.equal(parsed.page, 2);
assert.equal(parsed.sort, "jif_desc");

assert.equal(dedupeKey({ doi: "10.1000/ABC", pmid: "1", titleEn: "X", year: 2026 }), "doi:10.1000/abc");
assert.equal(dedupeKey({ pmid: "123", titleEn: "X", year: 2026 }), "pmid:123");
assert.equal(dedupeKey({ titleEn: " A   Title ", year: 2026 }), "title:a title:2026");

const publicFiles = [
  ...walk(join(process.cwd(), "src", "app")),
  ...walk(join(process.cwd(), "src", "components")),
  join(process.cwd(), "README.md"),
];
const banned = ["肿瘤科", "结直肠", "眼科", "消化内科", "肾内科"];
const offenders: string[] = [];
for (const file of publicFiles) {
  const text = readFileSync(file, "utf8");
  for (const term of banned) {
    if (text.includes(term)) offenders.push(`${file}: ${term}`);
  }
}
assert.deepEqual(offenders, []);

console.log("[urology-specialization-test] all checks passed.");
