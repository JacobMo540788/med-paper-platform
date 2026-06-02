import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryBrowser } from "@/components/library-browser";
import { specialtyFromSlug, SPECIALTY_CONFIG } from "@/lib/constants";
import { countLibraryArticles } from "@/lib/library";

type Props = { params: Promise<{ slug: string }> };

export default async function SpecialtyHistoryPage({ params }: Props) {
  const { slug } = await params;
  const specialty = specialtyFromSlug(slug);
  if (!specialty) notFound();

  const cfg = SPECIALTY_CONFIG[specialty];
  const counts = await countLibraryArticles(specialty);

  return (
    <div className="container mx-auto px-4 py-10">
      <Link href={`/specialty/${slug}`} className="text-sm text-primary hover:underline">
        ← 返回 {cfg.label}
      </Link>
      <LibraryBrowser
        slug={slug}
        libraryType="history"
        title={`${cfg.label} · 历史文献库`}
        description={`已归档的每日推荐论文，共 ${counts.history} 篇。支持按发表时间、IF、关键词、基础/临床类型检索。`}
      />
    </div>
  );
}
