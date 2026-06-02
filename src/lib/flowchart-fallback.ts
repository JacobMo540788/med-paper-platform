import type { AiAnalysis } from "./types";

function sanitizeMermaidLabel(text: string, max = 40): string {
  return text.replace(/"/g, "'").replace(/[[\]]/g, "").slice(0, max);
}

/** 旧数据无 flowchart 时，根据实验设计要点生成简易流程图 */
export function buildFallbackFlowchart(analysis: Pick<AiAnalysis, "goal" | "design" | "conclusion">): string {
  const steps =
    analysis.design.length > 0 ? analysis.design : ["研究设计", "实验实施", "数据分析"];
  const lines: string[] = ["flowchart TD"];
  const goal = sanitizeMermaidLabel(analysis.goal || "研究背景");
  lines.push(`  START["${goal}"]`);

  let prev = "START";
  steps.forEach((step, i) => {
    const id = `N${i}`;
    lines.push(`  ${id}["${sanitizeMermaidLabel(step)}"]`);
    lines.push(`  ${prev} --> ${id}`);
    prev = id;
  });

  lines.push(`  END["${sanitizeMermaidLabel(analysis.conclusion)}"]`);
  lines.push(`  ${prev} --> END`);

  return lines.join("\n");
}

export function resolveFlowchartMermaid(analysis: AiAnalysis): string {
  if (analysis.flowchart_mermaid?.trim()) {
    return analysis.flowchart_mermaid.trim();
  }
  return buildFallbackFlowchart(analysis);
}
