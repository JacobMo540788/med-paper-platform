import type { Specialty, StudyType } from "@prisma/client";
import { SPECIALTY_CONFIG, STUDY_TYPE_LABEL } from "../constants";
import { AiAnalysisSchema, type AiAnalysis } from "../types";
import { chatCompletion, extractJson } from "./client";
import { SYSTEM_MEDICAL_ANALYST, buildAnalysisPrompt, buildTranslationPrompt } from "./prompts";

export interface TranslationResult {
  title_cn: string;
  abstract_cn: string;
  one_line_summary: string;
}

export async function translatePaper(
  titleEn: string,
  abstract: string,
  options?: { timeoutMs?: number }
): Promise<TranslationResult> {
  const raw = await chatCompletion([
    { role: "system", content: SYSTEM_MEDICAL_ANALYST },
    { role: "user", content: buildTranslationPrompt({ titleEn, abstract }) },
  ], options);
  return extractJson<TranslationResult>(raw);
}

export async function analyzePaper(params: {
  titleEn: string;
  abstract: string;
  specialty: Specialty;
  studyType: StudyType;
  journal: string;
  timeoutMs?: number;
}): Promise<AiAnalysis> {
  const specialtyLabel = SPECIALTY_CONFIG[params.specialty].label;
  const studyLabel = STUDY_TYPE_LABEL[params.studyType];

  const raw = await chatCompletion(
    [
      { role: "system", content: SYSTEM_MEDICAL_ANALYST },
      {
        role: "user",
        content: buildAnalysisPrompt({
          titleEn: params.titleEn,
          abstract: params.abstract,
          specialty: specialtyLabel,
          studyType: studyLabel,
          journal: params.journal,
        }),
      },
    ],
    { timeoutMs: params.timeoutMs }
  );

  const parsed = extractJson<unknown>(raw);
  return AiAnalysisSchema.parse(parsed);
}

export async function runFullLlmPipeline(params: {
  titleEn: string;
  abstract: string;
  specialty: Specialty;
  studyType: StudyType;
  journal: string;
  timeoutMs?: number;
}): Promise<{
  titleCn: string;
  abstractCn: string;
  aiSummary: string;
  aiAnalysis: AiAnalysis;
}> {
  const [translation, analysis] = await Promise.all([
    translatePaper(params.titleEn, params.abstract, { timeoutMs: params.timeoutMs }),
    analyzePaper(params),
  ]);

  return {
    titleCn: translation.title_cn,
    abstractCn: translation.abstract_cn,
    aiSummary: translation.one_line_summary,
    aiAnalysis: analysis,
  };
}
