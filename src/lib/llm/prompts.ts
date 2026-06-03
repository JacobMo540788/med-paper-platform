export const SYSTEM_MEDICAL_ANALYST = `你是一名严谨的医学论文分析助手。
你只能基于输入中已经通过真实性校验的论文标题、摘要、学科、研究类型和期刊进行翻译、摘要和结构化分析。
严禁编造或补全 DOI、PMID、作者、期刊、发表日期、样本量、研究结果、统计值、结论或任何输入中不存在的信息。
如果摘要信息不足，请输出“原始摘要信息不足，无法可靠分析”，不要猜测。
你的输出必须是严格 JSON，不要输出 markdown 代码块。`;

export function buildAnalysisPrompt(params: {
  titleEn: string;
  abstract: string;
  specialty: string;
  studyType: string;
  journal: string;
}): string {
  return `请分析以下已通过真实性校验的医学论文。AI 只能做翻译、总结和解读，不能修改或生成论文元数据。

学科：${params.specialty}
研究类型：${params.studyType}
期刊：${params.journal}

英文标题：
${params.titleEn}

英文摘要：
${params.abstract || "原始摘要信息不足，无法可靠分析"}

请只输出以下 JSON 字段：
{
  "goal": "研究目的。摘要不足时写：原始摘要信息不足，无法可靠分析",
  "conclusion": "研究结论。不得添加输入中不存在的结果",
  "methods": "研究方法。不得猜测样本量、分组或统计结果",
  "design": ["设计要点1", "设计要点2"],
  "technologies": ["输入中出现或可由标题/摘要直接支持的技术"],
  "clinical_significance": "临床意义。信息不足时保持保守",
  "keywords_cn_en": [{"en": "English keyword", "cn": "中文关键词"}],
  "flowchart_mermaid": "flowchart TD\\n  A[\\\"研究背景\\\"] --> B[\\\"研究问题\\\"]\\n  B --> C[\\\"方法或数据来源\\\"]\\n  C --> D[\\\"主要观察\\\"]\\n  D --> E[\\\"谨慎结论\\\"]"
}

禁止输出或改写以下字段：titleEn、doi、pmid、journal、publishDate、authors、abstract。`;
}

export function buildTranslationPrompt(params: {
  titleEn: string;
  abstract: string;
}): string {
  return `请将以下已通过真实性校验的医学论文标题和摘要翻译为专业中文。
不得添加输入中不存在的信息，不得生成 DOI、PMID、作者、期刊或发表日期。
如果摘要为空或信息不足，abstract_cn 和 one_line_summary 都写“原始摘要信息不足，无法可靠分析”。

只输出 JSON：
{
  "title_cn": "中文标题",
  "abstract_cn": "中文摘要",
  "one_line_summary": "一句话中文总结"
}

英文标题：
${params.titleEn}

英文摘要：
${params.abstract || "原始摘要信息不足，无法可靠分析"}`;
}
