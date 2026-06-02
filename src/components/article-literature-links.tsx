import { ExternalLink } from "lucide-react";
import { buildLiteratureLinks, getPrimaryLiteratureLink } from "@/lib/article-links";
import { Button } from "./ui/button";

export function ArticleLiteratureLinks({
  article,
}: {
  article: {
    titleEn: string;
    doi?: string | null;
    pmid?: string | null;
    journal: string;
    externalUrl?: string | null;
  };
}) {
  const links = buildLiteratureLinks(article);
  const primary = getPrimaryLiteratureLink(links);
  const others = links.filter((l) => l.href !== primary?.href);

  if (links.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-5">
      <h2 className="font-serif text-lg font-semibold">文献原文链接</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        点击下方按钮在浏览器新标签页中打开论文（出版社、PubMed 等）。
      </p>

      {primary && (
        <div className="mt-4">
          <Button asChild size="lg" className="gap-2">
            <a href={primary.href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              {primary.label}
            </a>
          </Button>
          {primary.description && (
            <p className="mt-2 text-xs text-muted-foreground">{primary.description}</p>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((link) => (
            <Button key={link.href} variant="outline" size="sm" asChild className="gap-1.5">
              <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.description}>
                <ExternalLink className="h-3.5 w-3.5" />
                {link.label}
              </a>
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
