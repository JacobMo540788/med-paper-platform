import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceBrowser } from "@/components/resource-browser";
import { RESOURCE_KIND, RESEARCH_MIN_JIF } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "基础研究",
  description: "近5年 JIF≥10 的泌尿外科疾病相关基础、临床前和转化研究。",
};

export default function BasicResearchPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <Suspense fallback={<div className="text-muted-foreground">加载筛选器...</div>}>
        <ResourceBrowser
          resourceKind={RESOURCE_KIND.BASIC_RESEARCH}
          hideKindFilter
          title="基础研究"
          description={`收录分子机制、肿瘤生物学、组学、免疫微环境、动物和细胞实验等泌尿外科相关研究；正式列表需 JIF≥${RESEARCH_MIN_JIF} 且来源可核验。`}
        />
      </Suspense>
    </main>
  );
}
