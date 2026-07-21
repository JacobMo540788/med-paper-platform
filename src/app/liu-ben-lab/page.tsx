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
      <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
        作者身份消歧已完成：当前清单基于 13 名人工确认成员、明确 DOI/PMID、浙大一院泌尿外科单位信息、
        已核验邮箱及共同作者网络生成。系统仅导入清单中的高置信记录，不会根据短姓名自动合并论文。
      </div>
      <Suspense fallback={<div className="text-muted-foreground">加载筛选器...</div>}>
        <ResourceBrowser
          resourceKind={RESOURCE_KIND.LIU_BEN_LAB}
          hideKindFilter
          allowAllYears
          title="刘犇教授课题组论文"
          description="默认展示近5年论文，并可切换全部年份。每条记录均保存收录依据、作者身份核验证据和刘犇教授作者角色。"
        />
      </Suspense>
    </main>
  );
}
