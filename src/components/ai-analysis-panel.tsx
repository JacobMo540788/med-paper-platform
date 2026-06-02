import { CheckCircle2, FlaskConical, GitBranch, Microscope, Target } from "lucide-react";
import type { AiAnalysis } from "@/lib/types";
import { resolveFlowchartMermaid } from "@/lib/flowchart-fallback";
import { ResearchFlowchart } from "./research-flowchart";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function AiAnalysisPanel({ analysis }: { analysis: AiAnalysis }) {
  const flowchart = resolveFlowchartMermaid(analysis);

  return (
    <section className="space-y-6">
      <h2 className="font-serif text-2xl font-bold">AI 智能分析</h2>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">研究过程流程图</CardTitle>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              由在线 AI 根据摘要提炼的实验设计思路（自上而下展示）
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ResearchFlowchart chart={flowchart} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <AnalysisBlock icon={Target} title="研究目的" content={analysis.goal} />
        <AnalysisBlock icon={CheckCircle2} title="研究结论" content={analysis.conclusion} />
        <AnalysisBlock icon={Microscope} title="研究方法" content={analysis.methods} className="md:col-span-2" />
        <AnalysisBlock
          icon={FlaskConical}
          title="临床意义"
          content={analysis.clinical_significance}
          className="md:col-span-2"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">实验设计结构</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {analysis.design.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">核心技术手段</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analysis.technologies.map((t) => (
              <span key={t} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {t}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis.keywords_cn_en.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">关键词（中英双语）</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {analysis.keywords_cn_en.map((kw) => (
              <span key={kw.en} className="rounded border px-3 py-1 text-sm">
                <span className="font-medium">{kw.en}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{kw.cn}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function AnalysisBlock({
  icon: Icon,
  title,
  content,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
