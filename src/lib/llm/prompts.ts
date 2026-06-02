export const SYSTEM_MEDICAL_ANALYST = `你是一位资深医学科研分析师，精通肿瘤学、眼科学、消化内科、泌尿外科与肾内科。
你的任务是根据论文英文标题与摘要，输出严格 JSON（不要 markdown 代码块），用于医学前沿推送平台。
要求：
- 使用专业、准确的中文医学术语
- 不编造摘要中不存在的数据或结论
- 若信息不足，用保守表述（如"可能""提示"）
- JSON 字段必须完整`;

export function buildAnalysisPrompt(params: {
  titleEn: string;
  abstract: string;
  specialty: string;
  studyType: string;
  journal: string;
}): string {
  return `请分析以下医学论文，输出 JSON：

学科：${params.specialty}
研究类型：${params.studyType}
期刊：${params.journal}

英文标题：
${params.titleEn}

英文摘要：
${params.abstract || "（无摘要，请根据标题保守推断）"}

请输出以下 JSON 结构（字段名必须一致）：
{
  "goal": "一句话总结研究目的（中文）",
  "conclusion": "一句话总结研究结论（中文）",
  "methods": "研究方法简述（中文，1-2句）",
  "design": ["实验设计要点1", "实验设计要点2"],
  "technologies": ["核心技术1", "核心技术2"],
  "clinical_significance": "临床意义（中文，1-2句）",
  "keywords_cn_en": [{"en": "英文关键词", "cn": "中文关键词"}],
  "flowchart_mermaid": "flowchart TD\\n  A[\\\"研究假设/背景\\\"] --> B[\\\"队列或样本\\\"]\\n  B --> C[\\\"实验分组\\\"]\\n  C --> D[\\\"检测与分析\\\"]\\n  D --> E[\\\"主要结论\\\"]"
}

flowchart_mermaid 要求：
- 使用 Mermaid 的 flowchart TD 语法（自上而下）
- 6-12 个节点，完整呈现从研究背景、样本/队列、实验分组、核心实验、数据分析到结论的逻辑链
- 节点标签用中文，写在方括号内，例如 A["患者队列构建"]
- 体现基础或临床研究的实验设计细节（动物/细胞/患者、对照、干预、读出指标等）
- 仅使用 ASCII 与中文，不要换行符在节点文字内，用 \\n 连接各行
- 不要 markdown 代码块`;
}

export function buildTranslationPrompt(params: {
  titleEn: string;
  abstract: string;
}): string {
  return `请将以下医学论文内容翻译为专业中文，保持术语准确。输出 JSON（不要 markdown）：

{
  "title_cn": "中文标题",
  "abstract_cn": "中文摘要（完整翻译）",
  "one_line_summary": "一句话中文总结（不超过60字）"
}

英文标题：
${params.titleEn}

英文摘要：
${params.abstract || "无"}`;
}
