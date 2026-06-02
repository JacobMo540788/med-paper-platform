import { SubscribeForm } from "@/components/subscribe-form";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 prose prose-slate dark:prose-invert">
      <h1 className="font-serif text-3xl font-bold">关于 MedFrontier</h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        MedFrontier 是一个医学前沿研究自动推送平台，每日从 PubMed、Europe PMC 等公开数据库抓取
        肿瘤科（结直肠）、眼科、消化内科、泌尿外科、肾内科等领域的高影响因子论文。
      </p>
      <h2 className="mt-8 text-xl font-semibold">核心能力</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
        <li>IF &gt; 15 自动筛选，顶刊优先</li>
        <li>基础 / 临床研究自动分类</li>
        <li>LLM 生成中英双语摘要与结构化 AI 分析</li>
        <li>当日无更新时回退近 10 年经典文献</li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">技术栈</h2>
      <p className="text-muted-foreground">
        Next.js 15 · PostgreSQL · Prisma · Redis · BullMQ · Docker
      </p>
      <SubscribeForm />

      <p className="mt-8 text-sm text-muted-foreground">
        本平台内容仅供学术参考，不构成医疗建议。
      </p>
    </div>
  );
}
