import { SubscribeForm } from "@/components/subscribe-form";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 prose prose-slate dark:prose-invert">
      <h1 className="font-serif text-3xl font-bold">关于 MedFrontier</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        MedFrontier 是一个专注泌尿外科的指南与研究证据平台，整理临床指南、临床研究、基础研究和课题组成果。
        平台保留论文详情页、AI 辅助解读、主题切换和响应式布局，但所有公开记录都必须先通过可核验来源确认。
      </p>
      <h2 className="mt-8 text-xl font-semibold">核心原则</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
        <li>指南来自发布机构官网或正式出版物，不虚构 IF。</li>
        <li>临床和基础研究正式列表要求滚动近5年、JIF≥10、DOI/PMID/正式页面可核验。</li>
        <li>JIF 仅指 Clarivate Journal Citation Reports 的 Journal Impact Factor。</li>
        <li>AI 只做翻译、摘要和结构化分析，不生成 DOI、PMID、期刊、日期、作者或 IF。</li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">技术栈</h2>
      <p className="text-muted-foreground">Next.js 15 · PostgreSQL · Prisma · Redis · BullMQ · Netlify</p>
      <SubscribeForm />
      <p className="mt-8 text-sm text-muted-foreground">本平台内容仅供科研与学术参考，不构成医疗建议。</p>
    </div>
  );
}
