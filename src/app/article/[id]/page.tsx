import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AiAnalysis } from "@/lib/types";
import { getArticleById, getRelatedArticles, toCardDTO } from "@/lib/articles";
import {
  PIPELINE_STATUS,
  RESOURCE_KIND_LABEL,
  SPECIALTY_CONFIG,
  STUDY_TYPE_LABEL,
  type ResourceKind,
} from "@/lib/constants";
import { PublicationDate } from "@/components/publication-date";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { ArticleCard } from "@/components/article-card";
import { ArticleLiteratureLinks } from "@/components/article-literature-links";
import { FavoriteButton } from "@/components/favorite-button";
import { Badge } from "@/components/ui/badge";
import { decodeHtmlEntities } from "@/lib/html";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function jifText(article: { impactFactor: number; jifStatus?: string | null; jifYear?: number | null }) {
  if (article.jifStatus === "NOT_APPLICABLE") return "IF 不适用";
  if (article.jifStatus === "PENDING") return "IF 待核验";
  return `JIF ${article.impactFactor.toFixed(1)}${article.jifYear ? ` · ${article.jifYear}` : ""}`;
}

function isPublicArticle(article: Awaited<ReturnType<typeof getArticleById>>) {
  return article?.verificationStatus === "VERIFIED" && article.pipelineStatus === PIPELINE_STATUS.PUBLISHED;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return { title: "文献未找到" };
  if (!isPublicArticle(article)) return { title: "文献尚未通过公开发布审核" };

  return {
    title: article.titleCn ?? article.titleEn,
    description: article.aiSummary ?? (article.abstract ? decodeHtmlEntities(article.abstract).slice(0, 160) : undefined),
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

  if (!isPublicArticle(article)) {
    return (
      <article className="container mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h1 className="font-serif text-2xl font-bold">该文献尚未通过公开发布审核</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            医学文献必须完成来源、元数据、内容相关性和 JIF 等核验后才能公开展示。
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
  const abstractEn = article.abstract ? decodeHtmlEntities(article.abstract) : null;
  const resourceLabel = article.resourceKind ? RESOURCE_KIND_LABEL[article.resourceKind as ResourceKind] : null;

  return (
    <article className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{spec.label}</Badge>
          <Badge variant={article.studyType === "CLINICAL" ? "clinical" : "basic"}>
            {STUDY_TYPE_LABEL[article.studyType]}
          </Badge>
          {resourceLabel && <Badge>{resourceLabel}</Badge>}
          {article.diseaseArea && <Badge variant="outline">{article.diseaseArea}</Badge>}
          <Badge variant="outline">{jifText(article)}</Badge>
        </div>
        <FavoriteButton articleId={article.id} />
      </div>

      <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">{article.titleEn}</h1>
      {article.titleCn && <p className="mt-3 text-xl text-muted-foreground">{article.titleCn}</p>}

      <ArticleLiteratureLinks article={article} />

      <section className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="font-serif text-lg font-semibold">真实性与来源核验</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">流水线状态</dt>
            <dd className="text-muted-foreground">{article.pipelineStatus}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">数据来源</dt>
            <dd className="text-muted-foreground">{article.dataSource ?? article.sourceProvider ?? "verified source"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">JIF 状态</dt>
            <dd className="text-muted-foreground">
              {jifText(article)}
              {article.jifSource ? ` · ${article.jifSource}` : ""}
            </dd>
          </div>
          {article.dataVerifiedAt && (
            <div>
              <dt className="font-medium text-foreground">最后核验日期</dt>
              <dd className="text-muted-foreground">{article.dataVerifiedAt.toISOString().slice(0, 10)}</dd>
            </div>
          )}
          {article.pmid && (
            <div>
              <dt className="font-medium text-foreground">PMID</dt>
              <dd className="text-muted-foreground">{article.pmid}</dd>
            </div>
          )}
          {article.doi && (
            <div>
              <dt className="font-medium text-foreground">DOI</dt>
              <dd className="break-all text-muted-foreground">{article.doi}</dd>
            </div>
          )}
          {(article.officialUrl ?? article.sourceUrl) && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-foreground">官方或原始来源链接</dt>
              <dd>
                <a
                  href={article.officialUrl ?? article.sourceUrl ?? "#"}
                  className="break-all text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {article.officialUrl ?? article.sourceUrl}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <dl className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">期刊或发布机构</dt>
          <dd>{article.organization ?? article.journal}</dd>
        </div>
        {article.guidelineType && (
          <div>
            <dt className="font-medium text-foreground">指南类型</dt>
            <dd>{article.guidelineType}</dd>
          </div>
        )}
        {article.versionYear && (
          <div>
            <dt className="font-medium text-foreground">版本或更新年份</dt>
            <dd>{article.versionYear}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <PublicationDate date={article.publishDate} size="md" showIso />
        </div>
        {article.firstAuthor && (
          <div>
            <dt className="font-medium text-foreground">第一作者</dt>
            <dd>{article.firstAuthor}</dd>
          </div>
        )}
        {article.coFirstAuthors.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">共同第一作者</dt>
            <dd>{article.coFirstAuthors.join("; ")}</dd>
          </div>
        )}
        {article.correspondingAuthors.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">通讯作者</dt>
            <dd>{article.correspondingAuthors.join("; ")}</dd>
          </div>
        )}
        {article.liuBenRole && (
          <div>
            <dt className="font-medium text-foreground">刘犇教授作者角色</dt>
            <dd>{article.liuBenRole}</dd>
          </div>
        )}
        {article.authors.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">完整作者</dt>
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

      {(article.researchDesign || article.majorFindings || article.significance || article.inclusionEvidence) && (
        <section className="mt-10 grid gap-4 rounded-lg border p-5">
          <h2 className="font-serif text-xl font-semibold">结构化证据摘要</h2>
          {article.researchDesign && (
            <div>
              <h3 className="font-medium">研究设计</h3>
              <p className="mt-1 text-muted-foreground">{article.researchDesign}</p>
            </div>
          )}
          {article.majorFindings && (
            <div>
              <h3 className="font-medium">主要发现</h3>
              <p className="mt-1 text-muted-foreground">{article.majorFindings}</p>
            </div>
          )}
          {article.significance && (
            <div>
              <h3 className="font-medium">临床或基础研究意义</h3>
              <p className="mt-1 text-muted-foreground">{article.significance}</p>
            </div>
          )}
          {article.inclusionEvidence && (
            <div>
              <h3 className="font-medium">收录依据</h3>
              <p className="mt-1 text-muted-foreground">{article.inclusionEvidence}</p>
            </div>
          )}
        </section>
      )}

      {article.abstractCn && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-xl font-semibold">摘要（中文）</h2>
          <p className="leading-relaxed text-foreground/90">{article.abstractCn}</p>
        </section>
      )}

      {abstractEn && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold text-muted-foreground">Abstract (English)</h2>
          <p className="leading-relaxed text-muted-foreground">{abstractEn}</p>
        </section>
      )}

      {analysis ? (
        <div className="mt-12 border-t pt-10">
          <p className="mb-3 text-xs text-muted-foreground">
            AI辅助摘要：仅基于已核验来源文本生成，不作为引用来源。
          </p>
          <AiAnalysisPanel analysis={analysis} />
        </div>
      ) : (
        <p className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          AI 分析尚未生成。AI 仅会在文献真实性校验通过后运行。
        </p>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-bold">相关资源</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {related.map((r, i) => (
              <ArticleCard key={r.id} article={toCardDTO(r)} index={i} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        声明：本页内容仅供科研与学术参考，不构成医疗建议。
      </p>

      <div className="mt-10">
        <Link href="/" className="text-sm text-primary hover:underline">
          返回首页
        </Link>
      </div>
    </article>
  );
}
