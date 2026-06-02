import Link from "next/link";
import { fetchTodayCards } from "@/lib/articles";
import { formatBeijingTodayLabel } from "@/lib/beijing-time";
import { ArticleCard } from "@/components/article-card";
import { SPECIALTY_SLUGS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof fetchTodayCards>> = [];
  try {
    articles = await fetchTodayCards();
  } catch {
    articles = [];
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <section className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
          今日医学前沿推荐
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          高影响因子（IF &gt; 15）· Nature / NEJM / Lancet 等顶刊优先 · AI 智能解读
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          今日推荐（北京时间）· {formatBeijingTodayLabel()} · 每日 07:00 自动更新
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SPECIALTY_SLUGS.map((s) => (
            <Link
              key={s.slug}
              href={`/specialty/${s.slug}`}
              className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg">今日暂无推荐论文</p>
          <p className="mt-2 text-sm">
            系统将于每日北京时间 07:00 自动更新；亦可手动触发抓取，或前往各学科历史库 / 核心文献库浏览。
          </p>
          <code className="mt-4 block text-xs">
            npm run db:push && npm run db:seed
          </code>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
