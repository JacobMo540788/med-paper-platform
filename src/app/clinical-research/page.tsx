import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceBrowser } from "@/components/resource-browser";
import { RESOURCE_KIND, RESEARCH_MIN_JIF } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "临床研究",
  description: "近5年 JIF≥10 的泌尿外科临床研究、系统评价、Meta分析和高质量真实世界研究。",
};

export default function ClinicalResearchPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <Suspense fallback={<div className="text-muted-foreground">加载筛选器...</div>}>
        <ResourceBrowser
          resourceKind={RESOURCE_KIND.CLINICAL_RESEARCH}
          hideKindFilter
          title="临床研究"
          description={`收录正式发表日期位于滚动近5年窗口内、JIF≥${RESEARCH_MIN_JIF}、与泌尿外科直接相关且可核验 DOI/PMID/期刊页面的临床研究。`}
        />
      </Suspense>
    </main>
  );
}
