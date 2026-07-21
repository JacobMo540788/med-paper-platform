import type { Specialty, StudyType } from "@prisma/client";

export const SITE_NAME = "MedFrontier";
export const SITE_SUBTITLE = "泌尿外科指南与研究证据平台";
export const SITE_DESCRIPTION =
  "MedFrontier 专注泌尿外科临床指南、临床研究、基础研究和刘犇教授课题组成果，所有论文元数据均需通过可核验来源确认。";

export const UROLOGY_SPECIALTY: Specialty = "UROLOGY";
export const RESEARCH_MIN_JIF = 10;
export const ROLLING_WINDOW_YEARS = 5;
export const GUIDELINE_WINDOW_YEARS = 5;
export const WEEKLY_UPDATE_CRON = "0 7 * * 1";
export const BEIJING_TIMEZONE = "Asia/Shanghai";

// Legacy thresholds kept for older scripts that still import these names.
export const MIN_IMPACT_FACTOR = RESEARCH_MIN_JIF;
export const CORE_MIN_IMPACT_FACTOR = RESEARCH_MIN_JIF;
export const CORE_LIBRARY_YEARS = ROLLING_WINDOW_YEARS;
export const DAILY_UPDATE_CRON = WEEKLY_UPDATE_CRON;

export const RESOURCE_KIND = {
  GUIDELINE: "GUIDELINE",
  CLINICAL_RESEARCH: "CLINICAL_RESEARCH",
  BASIC_RESEARCH: "BASIC_RESEARCH",
  LIU_BEN_LAB: "LIU_BEN_LAB",
} as const;

export type ResourceKind = (typeof RESOURCE_KIND)[keyof typeof RESOURCE_KIND];

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  GUIDELINE: "临床指南",
  CLINICAL_RESEARCH: "临床研究",
  BASIC_RESEARCH: "基础研究",
  LIU_BEN_LAB: "刘犇教授课题组",
};

export const RESOURCE_NAV = [
  { href: "/", label: "首页" },
  { href: "/guidelines", label: "临床指南", kind: RESOURCE_KIND.GUIDELINE },
  { href: "/clinical-research", label: "临床研究", kind: RESOURCE_KIND.CLINICAL_RESEARCH },
  { href: "/basic-research", label: "基础研究", kind: RESOURCE_KIND.BASIC_RESEARCH },
  { href: "/liu-ben-lab", label: "刘犇教授课题组", kind: RESOURCE_KIND.LIU_BEN_LAB },
  { href: "/search", label: "全站搜索" },
  { href: "/about", label: "关于" },
] as const;

export const SPECIALTY_CONFIG: Record<
  Specialty,
  { label: string; labelEn: string; slug: string; pubmedQuery: string; active: boolean }
> = {
  ONCOLOGY_COLORECTAL: {
    label: "肿瘤科（结直肠）",
    labelEn: "Oncology (Colorectal)",
    slug: "oncology-colorectal",
    pubmedQuery: "",
    active: false,
  },
  OPHTHALMOLOGY: {
    label: "眼科",
    labelEn: "Ophthalmology",
    slug: "ophthalmology",
    pubmedQuery: "",
    active: false,
  },
  GASTROENTEROLOGY: {
    label: "消化内科",
    labelEn: "Gastroenterology",
    slug: "gastroenterology",
    pubmedQuery: "",
    active: false,
  },
  UROLOGY: {
    label: "泌尿外科",
    labelEn: "Urology",
    slug: "urology",
    active: true,
    pubmedQuery:
      '(urology[Title/Abstract] OR urologic[Title/Abstract] OR urological[Title/Abstract] OR prostate cancer[Title/Abstract] OR bladder cancer[Title/Abstract] OR renal cell carcinoma[Title/Abstract] OR kidney cancer[Title/Abstract] OR upper tract urothelial carcinoma[Title/Abstract] OR testicular cancer[Title/Abstract] OR penile cancer[Title/Abstract] OR benign prostatic hyperplasia[Title/Abstract] OR lower urinary tract symptoms[Title/Abstract] OR urinary stone[Title/Abstract] OR urolithiasis[Title/Abstract] OR urinary tract infection[Title/Abstract] OR urinary incontinence[Title/Abstract] OR neuro-urology[Title/Abstract] OR male infertility[Title/Abstract] OR erectile dysfunction[Title/Abstract] OR renal transplantation[Title/Abstract])',
  },
  NEPHROLOGY: {
    label: "肾内科",
    labelEn: "Nephrology",
    slug: "nephrology",
    pubmedQuery: "",
    active: false,
  },
};

export const SPECIALTY_SLUGS = Object.values(SPECIALTY_CONFIG)
  .filter((c) => c.active)
  .map((c) => ({ slug: c.slug, label: c.label }));

export const STUDY_TYPE_LABEL: Record<StudyType, string> = {
  BASIC: "基础研究",
  CLINICAL: "临床研究",
};

export const UROLOGY_DISEASE_AREAS = [
  "前列腺癌",
  "膀胱癌",
  "肾癌",
  "上尿路尿路上皮癌",
  "睾丸癌及阴茎癌",
  "良性前列腺增生与男性下尿路症状",
  "泌尿系结石",
  "尿路感染",
  "尿失禁与女性泌尿",
  "神经泌尿",
  "男科、男性不育与性功能障碍",
  "泌尿系统创伤与重建",
  "儿童泌尿",
  "肾移植及其他泌尿外科相关疾病",
] as const;

export const GUIDELINE_ORGANIZATIONS = [
  { shortName: "EAU", fullName: "European Association of Urology" },
  { shortName: "AUA", fullName: "American Urological Association" },
  { shortName: "NCCN", fullName: "National Comprehensive Cancer Network" },
  { shortName: "ASCO", fullName: "American Society of Clinical Oncology" },
  { shortName: "ESMO", fullName: "European Society for Medical Oncology" },
  { shortName: "NICE", fullName: "National Institute for Health and Care Excellence" },
  { shortName: "CUA", fullName: "中华医学会泌尿外科学分会" },
] as const;

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
  "european urology",
  "journal of urology",
  "uro-oncology",
];

export function todayPicksCacheKey(dateKey: string) {
  return `cache:today-picks:${dateKey}`;
}

export const CACHE_KEYS = {
  todayPicks: "cache:today-picks",
  specialty: (slug: string) => `cache:specialty:${slug}`,
  article: (id: string) => `cache:article:${id}`,
  resources: (key: string) => `cache:resources:${key}`,
};

export const CACHE_TTL = 3600;

export function specialtyFromSlug(slug: string): Specialty | null {
  const entry = Object.entries(SPECIALTY_CONFIG).find(([, v]) => v.slug === slug && v.active);
  return entry ? (entry[0] as Specialty) : null;
}

export function slugFromSpecialty(s: Specialty): string {
  return SPECIALTY_CONFIG[s].slug;
}
