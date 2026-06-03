import type { Specialty, StudyType } from "@prisma/client";

export const MIN_IMPACT_FACTOR = 15;
/** 核心文献库收录门槛 */
export const CORE_MIN_IMPACT_FACTOR = 15;
/** 核心文献库回溯年数 */
export const CORE_LIBRARY_YEARS = 15;
/** 每日首页更新：北京时间 07:00 */
export const DAILY_UPDATE_CRON = "0 7 * * *";
export const BEIJING_TIMEZONE = "Asia/Shanghai";

export const SPECIALTY_CONFIG: Record<
  Specialty,
  { label: string; labelEn: string; slug: string; pubmedQuery: string }
> = {
  ONCOLOGY_COLORECTAL: {
    label: "肿瘤科（结直肠）",
    labelEn: "Oncology (Colorectal)",
    slug: "oncology-colorectal",
    pubmedQuery:
      '(colorectal cancer[Title/Abstract] OR colorectal neoplasm[Title/Abstract]) AND (cancer OR carcinoma OR oncology)',
  },
  OPHTHALMOLOGY: {
    label: "眼科",
    labelEn: "Ophthalmology",
    slug: "ophthalmology",
    pubmedQuery: "ophthalmology[Title/Abstract] OR retina[Title/Abstract] OR glaucoma[Title/Abstract]",
  },
  GASTROENTEROLOGY: {
    label: "消化内科",
    labelEn: "Gastroenterology",
    slug: "gastroenterology",
    pubmedQuery: "gastroenterology[Title/Abstract] OR inflammatory bowel[Title/Abstract] OR liver disease[Title/Abstract]",
  },
  UROLOGY: {
    label: "泌尿外科",
    labelEn: "Urology",
    slug: "urology",
    pubmedQuery: "urology[Title/Abstract] OR prostate cancer[Title/Abstract] OR bladder cancer[Title/Abstract]",
  },
  NEPHROLOGY: {
    label: "肾内科",
    labelEn: "Nephrology",
    slug: "nephrology",
    pubmedQuery: "nephrology[Title/Abstract] OR chronic kidney disease[Title/Abstract] OR dialysis[Title/Abstract]",
  },
};

export const SPECIALTY_SLUGS = Object.values(SPECIALTY_CONFIG).map((c) => ({
  slug: c.slug,
  label: c.label,
}));

export const STUDY_TYPE_LABEL: Record<StudyType, string> = {
  BASIC: "基础研究",
  CLINICAL: "临床研究",
};

export const TOP_JOURNAL_KEYWORDS = [
  "nature",
  "science",
  "cell",
  "nejm",
  "new england journal",
  "lancet",
  "jama",
  "bmj",
  "nature medicine",
  "nature cancer",
  "nature biotechnology",
  "nature genetics",
  "nature communications",
  "science translational",
  "cancer cell",
  "cell metabolism",
];

export function todayPicksCacheKey(dateKey: string) {
  return `cache:today-picks:${dateKey}`;
}

export const CACHE_KEYS = {
  todayPicks: "cache:today-picks",
  specialty: (slug: string) => `cache:specialty:${slug}`,
  article: (id: string) => `cache:article:${id}`,
};

export const CACHE_TTL = 3600;

export function specialtyFromSlug(slug: string): Specialty | null {
  const entry = Object.entries(SPECIALTY_CONFIG).find(([, v]) => v.slug === slug);
  return entry ? (entry[0] as Specialty) : null;
}

export function slugFromSpecialty(s: Specialty): string {
  return SPECIALTY_CONFIG[s].slug;
}
