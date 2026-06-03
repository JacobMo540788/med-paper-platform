import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AiAnalysis } from "@/lib/types";
import { getArticleById, getRelatedArticles, toCardDTO } from "@/lib/articles";
import { SPECIALTY_CONFIG, STUDY_TYPE_LABEL } from "@/lib/constants";
import { PublicationDate } from "@/components/publication-date";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { ArticleCard } from "@/components/article-card";
import { ArticleLiteratureLinks } from "@/components/article-literature-links";
import { FavoriteButton } from "@/components/favorite-button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return { title: "文章未找到" };
  if (article.verificationStatus !== "VERIFIED") {
    return { title: "文献尚未通过真实性校验" };
  }

  return {
    title: article.titleCn ?? article.titleEn,
    description: article.aiSummary ?? article.abstract?.slice(0, 160),
    openGraph: {
      title: article.titleEn,
      description: article.aiSummary ?? undefined,
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  if (article.verificationStatus !== "VERIFIED") {
    return (
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h1 className="font-serif text-2xl font-bold">该文献尚未通过真实性校验，暂不展示。</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            医学论文元数据必须通过 PubMed、CrossRef 或可信来源校验后才能公开展示。
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
            返回首页
          </Link>
        </div>
      </article>
    );
  }

  const related = await getRelatedArticles(id, article.specialty);
  const spec = SPECIALTY_CONFIG[article.specialty];
  const analysis = article.aiAnalysisJson as AiAnalysis | null;
  const keywordsBilingual = article.keywordsBilingual as { en: string; cn: string }[] | null;

  return (
    <article className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{spec.label}</Badge>
          <Badge variant={article.studyType === "CLINICAL" ? "clinical" : "basic"}>
            {STUDY_TYPE_LABEL[article.studyType]}
          </Badge>
          <Badge variant="outline">IF {article.impactFactor.toFixed(1)}</Badge>
        </div>
        <FavoriteButton articleId={article.id} />
      </div>

      <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">{article.titleEn}</h1>
      {article.titleCn && <p className="mt-3 text-xl text-muted-foreground">{article.titleCn}</p>}

      <ArticleLiteratureLinks article={article} />

      <section className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="font-serif text-lg font-semibold">真实性校验</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">校验状态</dt>
            <dd className="text-muted-foreground">已通过</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">来源</dt>
            <dd className="text-muted-foreground">{article.sourceProvider ?? "verified source"}</dd>
          </div>
          {article.pmid && (
            <div>
              <dt className="font-medium text-foreground">PMID</dt>
              <dd className="text-muted-foreground">{article.pmid}</dd>
            </div>
          )}
          {article.doi && (
            <div>
              <dt className="font-medium text-foreground">DOI</dt>
              <dd className="text-muted-foreground">{article.doi}</dd>
            </div>
          )}
          {article.sourceUrl && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-foreground">原始来源链接</dt>
              <dd>
                <a
                  href={article.sourceUrl}
                  className="break-all text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {article.sourceUrl}
                </a>
              </dd>
            </div>
          )}
          {article.lastVerifiedAt && (
            <div>
              <dt className="font-medium text-foreground">最后校验时间</dt>
              <dd className="text-muted-foreground">{article.lastVerifiedAt.toISOString()}</dd>
            </div>
          )}
        </dl>
      </section>

      <dl className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">期刊</dt>
          <dd>{article.journal}</dd>
        </div>
        <div className="sm:col-span-2">
          <PublicationDate date={article.publishDate} size="md" showIso />
        </div>
        {article.authors.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">作者</dt>
            <dd>{article.authors.join("; ")}</dd>
          </div>
        )}
      </dl>

      {(keywordsBilingual?.length || article.keywords.length > 0) && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold">关键词</h2>
          <div className="flex flex-wrap gap-2">
            {keywordsBilingual?.map((kw) => (
              <span key={kw.en} className="rounded border px-3 py-1 text-sm">
                {kw.en} ({kw.cn})
              </span>
            )) ??
              article.keywords.map((kw) => (
                <span key={kw} className="rounded bg-muted px-3 py-1 text-sm">
                  {kw}
                </span>
              ))}
          </div>
        </section>
      )}

      {article.abstractCn && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-xl font-semibold">摘要（中文）</h2>
          <p className="leading-relaxed text-foreground/90">{article.abstractCn}</p>
        </section>
      )}

      {article.abstract && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold text-muted-foreground">
            Abstract (English)
          </h2>
          <p className="leading-relaxed text-muted-foreground">{article.abstract}</p>
        </section>
      )}

      {analysis ? (
        <div className="mt-12 border-t pt-10">
          <AiAnalysisPanel analysis={analysis} />
        </div>
      ) : (
        <p className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          AI 分析尚未生成。AI 仅会在文献真实性校验通过后运行。
        </p>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-bold">相关文章</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {related.map((r, i) => (
              <ArticleCard key={r.id} article={toCardDTO(r)} index={i} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <Link href="/" className="text-sm text-primary hover:underline">
          返回首页
        </Link>
      </div>
    </article>
  );
}
