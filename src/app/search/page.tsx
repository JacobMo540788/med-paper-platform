import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceBrowser } from "@/components/resource-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "全站搜索",
  description: "搜索泌尿外科临床指南、临床研究、基础研究和课题组论文。",
};

export default function SearchPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <Suspense fallback={<div className="text-muted-foreground">加载搜索...</div>}>
        <ResourceBrowser
          resourceKind="ALL"
          title="全站搜索"
          description="统一检索泌尿外科指南与研究证据，筛选和排序状态会写入 URL，方便刷新和分享。"
          allowAllYears
        />
      </Suspense>
    </main>
  );
}
