import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceBrowser } from "@/components/resource-browser";
import { RESOURCE_KIND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "刘犇教授课题组",
  description: "刘犇教授课题组论文列表。导入前必须完成作者身份消歧和权威来源核验。",
};

export default function LiuBenLabPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        刘犇教授课题组论文导入已暂停：还需要你补充英文名变体、所在单位、ORCID、个人主页或课题组主页。
        在完成作者身份消歧前，系统不会根据姓名自动合并论文。
      </div>
      <Suspense fallback={<div className="text-muted-foreground">加载筛选器...</div>}>
        <ResourceBrowser
          resourceKind={RESOURCE_KIND.LIU_BEN_LAB}
          hideKindFilter
          allowAllYears
          title="刘犇教授课题组论文"
          description="默认展示近5年论文，并可切换全部年份。每条记录需要保存收录依据、作者身份核验证据和刘犇教授作者角色。"
        />
      </Suspense>
    </main>
  );
}
