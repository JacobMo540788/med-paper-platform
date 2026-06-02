"use client";

import { useEffect, useRef, useState } from "react";

/** 用 Mermaid 渲染 AI 生成的研究流程图（客户端渲染） */
export function ResearchFlowchart({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark =
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark");

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "neutral",
          securityLevel: "strict",
          flowchart: { curve: "basis", padding: 16 },
        });

        const normalized = chart.replace(/\\n/g, "\n");
        const id = `med-flow-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, normalized);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch {
        if (!cancelled) setError("流程图渲染失败，请刷新页面重试。");
      }
    }

    renderChart();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-[200px] justify-center overflow-x-auto rounded-lg border bg-muted/20 p-4 [&_svg]:max-w-full"
      aria-label="研究流程图"
    />
  );
}
