import { strict as assert } from "node:assert";
import disambiguation from "../data/liu-ben-lab-disambiguation.json";
import { parsePubmedDate } from "../src/lib/fetchers/pubmed";

assert.equal(disambiguation.members.length, 13);
assert.equal(disambiguation.papers.length, 32);

const memberNames = new Set(disambiguation.members.map((member) => member.preferredName));
assert.equal(memberNames.size, disambiguation.members.length);

for (const member of disambiguation.members) {
  assert(member.nameVariants.includes(member.preferredName));
  assert(member.nameVariants.every((variant) => variant.trim().split(/\s+/).length >= 2));
  assert(member.evidence.length > 10);
}

const identifiers = new Set<string>();
for (const paper of disambiguation.papers) {
  assert(paper.doi || paper.pmid, `missing identifier: ${paper.title}`);
  assert(paper.title.trim().length > 20);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(paper.date));
  assert(paper.members.length > 0);
  assert(paper.evidenceSources.length > 0);
  assert(["通讯作者", "共同作者", "课题组成员论文（刘犇教授未署名）"].includes(paper.liuBenRole));
  for (const name of paper.members) assert(memberNames.has(name), `unknown member: ${name}`);

  const key = paper.doi ? `doi:${paper.doi.toLowerCase()}` : `pmid:${paper.pmid}`;
  assert(!identifiers.has(key), `duplicate identifier: ${key}`);
  identifiers.add(key);
}

const parsedFullDate = parsePubmedDate({ Year: "2025", Month: "Dec", Day: "24" });
assert.deepEqual(
  parsedFullDate && [parsedFullDate.getFullYear(), parsedFullDate.getMonth() + 1, parsedFullDate.getDate()],
  [2025, 12, 24]
);
assert.equal(parsePubmedDate({ MedlineDate: "2024 Nov-Dec" })?.getFullYear(), 2024);

console.log("[liu-ben-lab-disambiguation-test] all checks passed.");
