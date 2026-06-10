import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBeijingDateKey } from "@/lib/beijing-time";
import { specialtyFromSlug, SPECIALTY_CONFIG } from "@/lib/constants";
import { countLibraryArticles } from "@/lib/library";
import { toCardDTO } from "@/lib/articles";
import { ArticleCard } from "@/components/article-card";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function SpecialtyPage({ params }: Props) {
  const { slug } = await params;
  const specialty = specialtyFromSlug(slug);
  if (!specialty) notFound();

  const cfg = SPECIALTY_CONFIG[specialty];
  const todayKey = getBeijingDateKey();
  const counts = await countLibraryArticles(specialty);

  const todayArticles = await prisma.article.findMany({
    where: { specialty, isTodayPick: true, featuredDateKey: todayKey, verificationStatus: "VERIFIED" },
    orderBy: [{ impactFactor: "desc" }, { publishDate: "desc" }],
    take: 12,
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">{cfg.label}</h1>
      <p className="mt-2 text-muted-foreground">{cfg.labelEn}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/specialty/${slug}/history`}
          className="rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-accent"
        >
          <span className="font-semibold">历史文献库</span>
          <span className="ml-2 text-muted-foreground">{counts.history} 篇</span>
        </Link>
        <Link
          href={`/specialty/${slug}/core`}
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
        >
          <span className="font-semibold">核心文献库</span>
          <span className="ml-2 text-muted-foreground">IF&gt;15 · {counts.core} 篇</span>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">今日推荐（本学科）</h2>
        {todayArticles.length === 0 ? (
          <p className="mt-4 text-muted-foreground">今日暂无该学科推荐，请查看历史库或核心库。</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {todayArticles.map((a, i) => (
              <ArticleCard key={a.id} article={toCardDTO(a)} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
