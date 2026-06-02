import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryBrowser } from "@/components/library-browser";
import { CORE_MIN_IMPACT_FACTOR, specialtyFromSlug, SPECIALTY_CONFIG } from "@/lib/constants";
import { countLibraryArticles } from "@/lib/library";

type Props = { params: Promise<{ slug: string }> };

export default async function SpecialtyCorePage({ params }: Props) {
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
        libraryType="core"
        title={`${cfg.label} · 核心文献库`}
        description={`近15年 IF>${CORE_MIN_IMPACT_FACTOR} 高影响因子论文，顶刊优先。共 ${counts.core} 篇。`}
        defaultMinIf={CORE_MIN_IMPACT_FACTOR}
      />
    </div>
  );
}
