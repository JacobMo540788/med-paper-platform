"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { RESOURCE_KIND, RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/constants";
import type { ArticleCardDTO } from "@/lib/types";

interface Facets {
  diseaseAreas: string[];
  years: number[];
  venues: string[];
  studyTypes: string[];
  liuBenRoles: string[];
}

const SORT_OPTIONS = [
  { value: "date_desc", label: "时间：最新优先" },
  { value: "date_asc", label: "时间：最早优先" },
  { value: "jif_desc", label: "影响因子：从高到低" },
  { value: "first_author_asc", label: "第一作者：A-Z" },
];

function readCsv(sp: URLSearchParams, key: string) {
  return sp.get(key) ?? "";
}

export function ResourceBrowser({
  resourceKind = "ALL",
  title,
  description,
  hideKindFilter = false,
  allowAllYears = false,
}: {
  resourceKind?: ResourceKind | "ALL";
  title: string;
  description: string;
  hideKindFilter?: boolean;
  allowAllYears?: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<ArticleCardDTO[]>([]);
  const [facets, setFacets] = useState<Facets>({
    diseaseAreas: [],
    years: [],
    venues: [],
    studyTypes: [],
    liuBenRoles: [],
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const state = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      kind: (searchParams.get("resourceKind") as ResourceKind | "ALL") || resourceKind,
      diseaseArea: readCsv(searchParams, "diseaseArea"),
      year: readCsv(searchParams, "year"),
      venue: readCsv(searchParams, "venue"),
      studyType: searchParams.get("studyType") ?? "",
      minJif: searchParams.get("minJif") ?? (resourceKind === RESOURCE_KIND.GUIDELINE ? "" : "10"),
      liuBenRole: searchParams.get("liuBenRole") ?? "",
      sort: searchParams.get("sort") ?? "date_desc",
      includeAllYears: searchParams.get("includeAllYears") === "1",
    }),
    [resourceKind, searchParams]
  );

  const updateUrl = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      const effectiveKind = hideKindFilter ? resourceKind : state.kind;
      if (effectiveKind && effectiveKind !== "ALL") next.set("resourceKind", effectiveKind);

      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch)) next.set("page", "1");
      router.push(`${pathname}?${next.toString()}`);
    },
    [hideKindFilter, pathname, resourceKind, router, searchParams, state.kind]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get("resourceKind") && resourceKind !== "ALL") params.set("resourceKind", resourceKind);
    const res = await fetch(`/api/resources?${params.toString()}`);
    const json = await res.json();
    setItems(json.items ?? []);
    setFacets(json.facets ?? facets);
    setTotal(json.total ?? 0);
    setPage(json.page ?? 1);
    setLoading(false);
  }, [facets, resourceKind, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const showJifFilter = state.kind !== RESOURCE_KIND.GUIDELINE;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">{title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)} className="md:hidden">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          筛选
        </Button>
      </div>

      <div className={`mt-6 rounded-lg border p-4 ${filtersOpen ? "grid" : "hidden"} gap-3 md:grid md:grid-cols-2 lg:grid-cols-4`}>
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
          placeholder="关键词、标题、DOI、PMID、机构或期刊"
          defaultValue={state.q}
          onBlur={(e) => updateUrl({ q: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && updateUrl({ q: (e.target as HTMLInputElement).value })}
          aria-label="关键词搜索"
        />
        {!hideKindFilter && (
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={state.kind}
            onChange={(e) => updateUrl({ resourceKind: e.target.value })}
            aria-label="板块类型"
          >
            <option value="ALL">全部板块</option>
            {Object.entries(RESOURCE_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={state.diseaseArea}
          onChange={(e) => updateUrl({ diseaseArea: e.target.value })}
          aria-label="病种筛选"
        >
          <option value="">全部病种</option>
          {facets.diseaseAreas.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={state.year}
          onChange={(e) => updateUrl({ year: e.target.value })}
          aria-label="年份筛选"
        >
          <option value="">全部年份</option>
          {facets.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={state.venue}
          onChange={(e) => updateUrl({ venue: e.target.value })}
          aria-label="机构或期刊筛选"
        >
          <option value="">全部机构/期刊</option>
          {facets.venues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={state.studyType}
          onChange={(e) => updateUrl({ studyType: e.target.value })}
          aria-label="研究类型筛选"
        >
          <option value="">全部研究类型</option>
          <option value="CLINICAL">临床研究</option>
          <option value="BASIC">基础研究</option>
        </select>
        {showJifFilter && (
          <input
            type="number"
            step="0.1"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="最低 JIF"
            defaultValue={state.minJif}
            onBlur={(e) => updateUrl({ minJif: e.target.value })}
            aria-label="最低JIF"
          />
        )}
        {state.kind === RESOURCE_KIND.LIU_BEN_LAB && (
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={state.liuBenRole}
            onChange={(e) => updateUrl({ liuBenRole: e.target.value })}
            aria-label="刘犇教授作者角色"
          >
            <option value="">全部作者角色</option>
            {facets.liuBenRoles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        {allowAllYears && (
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={state.includeAllYears}
              onChange={(e) => updateUrl({ includeAllYears: e.target.checked ? "1" : "" })}
            />
            全部年份
          </label>
        )}
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={state.sort}
          onChange={(e) => updateUrl({ sort: e.target.value })}
          aria-label="排序方式"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {total} 条结果</span>
        {loading && <span>加载中...</span>}
      </div>

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          暂无符合条件的真实记录。请放宽筛选条件，或等待下一次数据更新。
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i} />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => updateUrl({ page: page - 1 })}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          disabled={items.length === 0 || page * 20 >= total}
          onClick={() => updateUrl({ page: page + 1 })}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
