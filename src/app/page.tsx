import Link from "next/link";
import { BookOpen, FlaskConical, ScrollText, Users } from "lucide-react";
import { getUrologyOverview } from "@/lib/urology-resources";
import { RESOURCE_KIND, SITE_SUBTITLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const BLOCKS = [
  {
    href: "/guidelines",
    title: "近5年临床指南",
    description: "EAU、AUA、NCCN、NICE 等权威来源可核验的指南、指南更新和正式共识。",
    icon: ScrollText,
    key: "guidelines",
    kind: RESOURCE_KIND.GUIDELINE,
  },
  {
    href: "/clinical-research",
    title: "近5年高影响力临床研究",
    description: "JIF≥10、可核验 DOI/PMID、直接服务泌尿外科临床决策的研究证据。",
    icon: BookOpen,
    key: "clinical",
    kind: RESOURCE_KIND.CLINICAL_RESEARCH,
  },
  {
    href: "/basic-research",
    title: "近5年高影响力基础研究",
    description: "肿瘤生物学、组学、免疫微环境、动物和细胞实验等临床前证据。",
    icon: FlaskConical,
    key: "basic",
    kind: RESOURCE_KIND.BASIC_RESEARCH,
  },
  {
    href: "/liu-ben-lab",
    title: "刘犇教授课题组论文",
    description: "完成作者身份消歧后展示课题组成果，并保留收录依据和作者角色。",
    icon: Users,
    key: "lab",
    kind: RESOURCE_KIND.LIU_BEN_LAB,
  },
] as const;

export default async function HomePage() {
  const overview = await getUrologyOverview().catch(() => null);
  const start = overview?.fiveYearStart;
  const startLabel = start ? start.toLocaleDateString("zh-CN") : "动态近5年";
  const latest = overview?.latestUpdate?.toLocaleString("zh-CN") ?? "暂无已核验记录";

  return (
    <div className="container mx-auto px-4 py-10">
      <section className="mb-10">
        <p className="text-sm font-medium text-primary">MedFrontier</p>
        <h1 className="mt-2 max-w-4xl font-serif text-4xl font-bold tracking-tight md:text-5xl">
          {SITE_SUBTITLE}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
          面向泌尿外科的指南与研究证据索引。平台只展示可核验来源，JIF 指 Clarivate Journal Citation Reports
          的 Journal Impact Factor；无法核验的 JIF 不参与 JIF≥10 正式列表。
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="rounded-full border px-3 py-1">滚动窗口：{startLabel} 至今</span>
          <span className="rounded-full border px-3 py-1">最近更新：{latest}</span>
          <span className="rounded-full border px-3 py-1">仅供科研与学术参考</span>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {BLOCKS.map((block) => {
          const Icon = block.icon;
          const count = overview?.counts[block.key] ?? 0;
          return (
            <Link
              key={block.href}
              href={block.href}
              className="rounded-lg border p-5 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-semibold">{block.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.description}</p>
                </div>
                <Icon className="h-7 w-7 shrink-0 text-primary" />
              </div>
              <div className="mt-5 text-sm text-muted-foreground">
                已收录 <span className="font-semibold text-foreground">{count}</span> 条
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-10 rounded-lg border bg-muted/30 p-5">
        <h2 className="font-serif text-xl font-semibold">数据原则</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          指南必须来自发布机构官网或正式出版物；临床和基础研究必须有 DOI、PMID、期刊页面或数据库来源；
          不生成虚构论文、虚构指南、虚构摘要、虚构作者或虚构影响因子。
        </p>
      </section>
    </div>
  );
}
