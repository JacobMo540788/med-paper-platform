import { verifyArticle } from "../src/lib/validation/article-verifier";

async function expectFailed(name: string, input: Parameters<typeof verifyArticle>[0]) {
  const result = await verifyArticle(input);
  if (result.ok) {
    throw new Error(`${name}: expected verification to fail, but it passed.`);
  }
  console.log(`${name}: failed as expected (${result.error})`);
}

async function main() {
  await expectFailed("missing DOI and PMID", {
    titleEn: "Unverifiable article",
    journal: "Unknown Journal",
  });

  await expectFailed("non-existent DOI", {
    titleEn: "Unverifiable article",
    journal: "Unknown Journal",
    doi: "10.0000/med-paper-platform-non-existent-test-doi",
  });

  await expectFailed("non-existent PMID", {
    titleEn: "Unverifiable article",
    journal: "Unknown Journal",
    pmid: "0",
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
