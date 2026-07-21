import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceBrowser } from "@/components/resource-browser";
import { RESOURCE_KIND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "临床指南",
  description: "近5年泌尿外科临床指南、指南更新和正式共识，优先收录可由发布机构官网或正式出版物核验的来源。",
};

export default function GuidelinesPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <Suspense fallback={<div className="text-muted-foreground">加载筛选器...</div>}>
        <ResourceBrowser
          resourceKind={RESOURCE_KIND.GUIDELINE}
          hideKindFilter
          title="临床指南"
          description="只收录能够在发布机构官网或正式出版物中核验的泌尿外科指南、指南更新和正式共识。指南无 JIF 时标记为 IF 不适用或待核验。"
        />
      </Suspense>
    </main>
  );
}
