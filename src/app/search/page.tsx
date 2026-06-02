"use client";

import { useCallback, useState } from "react";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import type { ArticleCardDTO } from "@/lib/types";

const SPECIALTIES = [
  { value: "", label: "全部学科" },
  { value: "ONCOLOGY_COLORECTAL", label: "肿瘤科（结直肠）" },
  { value: "OPHTHALMOLOGY", label: "眼科" },
  { value: "GASTROENTEROLOGY", label: "消化内科" },
  { value: "UROLOGY", label: "泌尿外科" },
  { value: "NEPHROLOGY", label: "肾内科" },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [studyType, setStudyType] = useState("");
  const [minIf, setMinIf] = useState("15");
  const [items, setItems] = useState<ArticleCardDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (specialty) params.set("specialty", specialty);
    if (studyType) params.set("studyType", studyType);
    if (minIf) params.set("minIf", minIf);

    const res = await fetch(`/api/search?${params}`);
    const json = await res.json();
    setItems(json.items ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [q, specialty, studyType, minIf]);

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">论文搜索</h1>

      <div className="mt-6 grid gap-4 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-4">
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm lg:col-span-2"
          placeholder="关键词、标题、期刊..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        >
          {SPECIALTIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={studyType}
          onChange={(e) => setStudyType(e.target.value)}
        >
          <option value="">全部类型</option>
          <option value="BASIC">基础研究</option>
          <option value="CLINICAL">临床研究</option>
        </select>
        <input
          type="number"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="最低 IF"
          value={minIf}
          onChange={(e) => setMinIf(e.target.value)}
        />
        <Button onClick={search} disabled={loading} className="lg:col-span-4">
          {loading ? "搜索中..." : "搜索"}
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">共 {total} 篇结果</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((a, i) => (
          <ArticleCard key={a.id} article={a} index={i} />
        ))}
      </div>
    </div>
  );
}
