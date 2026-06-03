export interface LiteratureLink {
  label: string;
  href: string;
  description?: string;
  primary?: boolean;
}

export function buildLiteratureLinks(article: {
  titleEn: string;
  doi?: string | null;
  pmid?: string | null;
  journal: string;
  externalUrl?: string | null;
  sourceUrl?: string | null;
}): LiteratureLink[] {
  const links: LiteratureLink[] = [];

  if (article.sourceUrl) {
    links.push({
      label: "原始来源",
      href: article.sourceUrl,
      description: "已校验文献的真实来源链接",
      primary: true,
    });
  }

  if (article.doi) {
    links.push({
      label: "DOI",
      href: `https://doi.org/${article.doi}`,
      description: "通过 DOI 解析文献来源",
      primary: !links.some((link) => link.primary),
    });
  }

  if (article.pmid) {
    links.push({
      label: "PubMed",
      href: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      description: "PubMed 文献条目",
      primary: !links.some((link) => link.primary),
    });
    links.push({
      label: "Europe PMC",
      href: `https://europepmc.org/article/MED/${article.pmid}`,
      description: "Europe PMC 文献条目",
    });
  }

  return links;
}

export function getPrimaryLiteratureLink(links: LiteratureLink[]): LiteratureLink | undefined {
  return links.find((l) => l.primary) ?? links[0];
}
