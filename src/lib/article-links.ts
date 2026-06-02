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
}): LiteratureLink[] {
  const links: LiteratureLink[] = [];

  if (article.doi) {
    links.push({
      label: "出版社全文（DOI）",
      href: `https://doi.org/${article.doi}`,
      description: "跳转到期刊官方页面",
      primary: true,
    });
    links.push({
      label: "Europe PMC",
      href: `https://europepmc.org/article/MED/DOI/${encodeURIComponent(article.doi)}`,
      description: "开放获取全文（如有）",
    });
  }

  if (article.pmid && !article.pmid.startsWith("demo-")) {
    links.push({
      label: "PubMed",
      href: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      description: "美国国立医学图书馆条目",
      primary: !article.doi,
    });
    links.push({
      label: "Europe PMC",
      href: `https://europepmc.org/article/MED/${article.pmid}`,
      description: "欧洲开放文献库",
    });
  } else if (article.pmid?.startsWith("demo-")) {
    links.push({
      label: "PubMed（演示数据）",
      href: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(article.titleEn)}`,
      description: "演示论文，按标题检索相似文献",
    });
  }

  if (article.externalUrl) {
    links.push({
      label: "文献直达",
      href: article.externalUrl,
      description: "原始来源链接",
      primary: true,
    });
  }

  const scholarQuery = encodeURIComponent(`${article.titleEn} ${article.journal}`);
  links.push({
    label: "Google Scholar",
    href: `https://scholar.google.com/scholar?q=${scholarQuery}`,
    description: "学术搜索",
  });

  return links;
}

export function getPrimaryLiteratureLink(links: LiteratureLink[]): LiteratureLink | undefined {
  return links.find((l) => l.primary) ?? links[0];
}
