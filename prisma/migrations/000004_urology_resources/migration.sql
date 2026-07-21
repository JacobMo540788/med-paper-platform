ALTER TABLE "articles"
ADD COLUMN "jif_status" TEXT NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN "jif_year" INTEGER,
ADD COLUMN "jif_source" TEXT,
ADD COLUMN "jif_verified_at" TIMESTAMP(3),
ADD COLUMN "first_author" TEXT,
ADD COLUMN "author_sort_key" TEXT,
ADD COLUMN "co_first_authors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "corresponding_authors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "year" INTEGER,
ADD COLUMN "resource_kind" TEXT NOT NULL DEFAULT 'CLINICAL_RESEARCH',
ADD COLUMN "disease_area" TEXT,
ADD COLUMN "organization" TEXT,
ADD COLUMN "organization_short_name" TEXT,
ADD COLUMN "version_year" INTEGER,
ADD COLUMN "guideline_type" TEXT,
ADD COLUMN "official_url" TEXT,
ADD COLUMN "research_design" TEXT,
ADD COLUMN "major_findings" TEXT,
ADD COLUMN "significance" TEXT,
ADD COLUMN "key_points" JSONB,
ADD COLUMN "liu_ben_role" TEXT,
ADD COLUMN "inclusion_evidence" TEXT,
ADD COLUMN "data_source" TEXT,
ADD COLUMN "data_verified_at" TIMESTAMP(3);

UPDATE "articles"
SET
  "year" = EXTRACT(YEAR FROM "publish_date")::INTEGER,
  "first_author" = CASE WHEN array_length("authors", 1) >= 1 THEN "authors"[1] ELSE NULL END,
  "author_sort_key" = lower(regexp_replace(CASE WHEN array_length("authors", 1) >= 1 THEN "authors"[1] ELSE '' END, '[^[:alnum:]]+', '', 'g')),
  "data_source" = COALESCE("source_provider", 'legacy'),
  "data_verified_at" = COALESCE("last_verified_at", "updated_at"),
  "jif_year" = 2024,
  "jif_source" = 'local JCR whitelist',
  "jif_verified_at" = COALESCE("last_verified_at", "updated_at");

UPDATE "articles"
SET "disease_area" = CASE
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%prostate%' OR lower(COALESCE("abstract", '')) LIKE '%prostate%') THEN '前列腺癌'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%bladder%' OR lower(COALESCE("abstract", '')) LIKE '%bladder%') THEN '膀胱癌'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%renal cell%' OR lower("title_en") LIKE '%kidney cancer%' OR lower(COALESCE("abstract", '')) LIKE '%renal cell%') THEN '肾癌'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%upper tract urothelial%' OR lower(COALESCE("abstract", '')) LIKE '%upper tract urothelial%') THEN '上尿路尿路上皮癌'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%testicular%' OR lower("title_en") LIKE '%penile%') THEN '睾丸癌及阴茎癌'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%benign prostatic hyperplasia%' OR lower("title_en") LIKE '%lower urinary tract symptoms%') THEN '良性前列腺增生与男性下尿路症状'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%stone%' OR lower("title_en") LIKE '%urolithiasis%') THEN '泌尿系结石'
  WHEN "specialty" = 'UROLOGY' AND lower("title_en") LIKE '%urinary tract infection%' THEN '尿路感染'
  WHEN "specialty" = 'UROLOGY' AND lower("title_en") LIKE '%incontinence%' THEN '尿失禁与女性泌尿'
  WHEN "specialty" = 'UROLOGY' AND lower("title_en") LIKE '%neuro%' THEN '神经泌尿'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%infertility%' OR lower("title_en") LIKE '%erectile%') THEN '男科、男性不育与性功能障碍'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%trauma%' OR lower("title_en") LIKE '%reconstruct%') THEN '泌尿系统创伤与重建'
  WHEN "specialty" = 'UROLOGY' AND (lower("title_en") LIKE '%pediatric%' OR lower("title_en") LIKE '%paediatric%') THEN '儿童泌尿'
  WHEN "specialty" = 'UROLOGY' AND lower("title_en") LIKE '%transplant%' THEN '肾移植及其他泌尿外科相关疾病'
  WHEN "specialty" = 'UROLOGY' THEN '肾移植及其他泌尿外科相关疾病'
  ELSE "disease_area"
END;

UPDATE "articles"
SET "resource_kind" = CASE
  WHEN "specialty" = 'UROLOGY' AND lower(COALESCE("article_type", '')) LIKE '%guideline%' THEN 'GUIDELINE'
  WHEN "specialty" = 'UROLOGY' AND "study_type" = 'BASIC' THEN 'BASIC_RESEARCH'
  WHEN "specialty" = 'UROLOGY' THEN 'CLINICAL_RESEARCH'
  ELSE 'CLINICAL_RESEARCH'
END;

CREATE INDEX "articles_resource_kind_idx" ON "articles"("resource_kind");
CREATE INDEX "articles_disease_area_idx" ON "articles"("disease_area");
CREATE INDEX "articles_year_idx" ON "articles"("year");
CREATE INDEX "articles_jif_status_idx" ON "articles"("jif_status");
CREATE INDEX "articles_author_sort_key_idx" ON "articles"("author_sort_key");
