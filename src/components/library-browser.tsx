"use client";

import { useCallback, useState } from "react";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import type { ArticleCardDTO } from "@/lib/types";
import type { LibraryType } from "@/lib/library";

const STUDY_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "BASIC", label: "基础研究" },
  { value: "CLINICAL", label: "临床研究" },
];

const SORT_OPTIONS = [
  { value: "publishDate", label: "按发表时间" },
  { value: "impactFactor", label: "按 IF" },
  { value: "archivedAt", label: "按归档时间" },
];

export function LibraryBrowser({
  slug,
  libraryType,
  title,
  description,
  defaultMinIf,
}: {
  slug: string;
  libraryType: LibraryType;
  title: string;
  description: string;
  defaultMinIf?: number;
}) {
  const [q, setQ] = useState("");
  const [studyType, setStudyType] = useState("");
  const [minIf, setMinIf] = useState(defaultMinIf?.toString() ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState(libraryType === "history" ? "archivedAt" : "impactFactor");
  const [order, setOrder] = useState("desc");
  const [items, setItems] = useState<ArticleCardDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: libraryType });
    if (q) params.set("q", q);
    if (studyType) params.set("studyType", studyType);
    if (minIf) params.set("minIf", minIf);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);

    const res = await fetch(`/api/specialty/${slug}/library?${params}`);
    const json = await res.json();
    setItems(json.items ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [slug, libraryType, q, studyType, minIf, dateFrom, dateTo, sort, order]);

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>

      <div className="mt-6 grid gap-3 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3">
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2 lg:col-span-3"
          placeholder="关键词、标题、期刊..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={studyType}
          onChange={(e) => setStudyType(e.target.value)}
        >
          {STUDY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="最低 IF"
          value={minIf}
          onChange={(e) => setMinIf(e.target.value)}
        />
        <input
          type="date"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="发表起始日期"
        />
        <input
          type="date"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="发表截止日期"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORT_OPTIONS.filter((o) => libraryType === "history" || o.value !== "archivedAt").map(
            (o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )
          )}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="desc">降序</option>
          <option value="asc">升序</option>
        </select>
        <Button onClick={search} disabled={loading} className="lg:col-span-3">
          {loading ? "检索中..." : "检索"}
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">共 {total} 篇</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((a, i) => (
          <ArticleCard key={a.id} article={a} index={i} />
        ))}
      </div>
    </div>
  );
}
