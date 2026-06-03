import type { Specialty, StudyType } from "@prisma/client";
import { z } from "zod";

export interface RawPaper {
  titleEn: string;
  abstract?: string;
  journal: string;
  doi?: string;
  pmid?: string;
  authors: string[];
  publishDate: Date;
  keywords: string[];
  articleType?: string;
  externalUrl?: string;
  sourceProvider?: string;
  specialty: Specialty;
}

export const AiAnalysisSchema = z.object({
  goal: z.string(),
  conclusion: z.string(),
  methods: z.string(),
  design: z.array(z.string()),
  technologies: z.array(z.string()),
  clinical_significance: z.string(),
  keywords_cn_en: z.array(
    z.object({
      en: z.string(),
      cn: z.string(),
    })
  ),
  /** Mermaid flowchart TD 语法，由在线 LLM 生成研究过程流程图 */
  flowchart_mermaid: z.string().optional(),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

export interface ArticleCardDTO {
  id: string;
  titleEn: string;
  titleCn: string | null;
  specialty: Specialty;
  studyType: StudyType;
  impactFactor: number;
  journal: string;
  publishDate: string;
  keywords: string[];
  aiSummary: string | null;
}
