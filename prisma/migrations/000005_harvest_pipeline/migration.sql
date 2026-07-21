-- Add staged harvesting, audit trail, structured JIF metadata, run logs and locks.

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "pipeline_status" TEXT NOT NULL DEFAULT 'DISCOVERED',
  ADD COLUMN IF NOT EXISTS "raw_source" TEXT,
  ADD COLUMN IF NOT EXISTS "raw_source_url" TEXT,
  ADD COLUMN IF NOT EXISTS "source_record_id" TEXT,
  ADD COLUMN IF NOT EXISTS "fetched_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "raw_metadata_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "validation_trail" JSONB,
  ADD COLUMN IF NOT EXISTS "exclusion_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "ai_model" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_prompt_version" TEXT,
  ADD COLUMN IF NOT EXISTS "content_reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);

UPDATE "articles"
SET
  "source_record_id" = COALESCE("source_record_id", "pmid", "doi", "id"),
  "fetched_at" = COALESCE("fetched_at", "created_at"),
  "raw_source" = COALESCE("raw_source", "source_provider", "source"::TEXT),
  "raw_source_url" = COALESCE("raw_source_url", "source_url", "external_url"),
  "content_reviewed_at" = COALESCE("content_reviewed_at", "last_verified_at"),
  "published_at" = CASE
    WHEN "published_at" IS NOT NULL THEN "published_at"
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" = 'GUIDELINE' THEN COALESCE("last_verified_at", "updated_at")
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" IN ('CLINICAL_RESEARCH', 'BASIC_RESEARCH')
      AND "jif_status" = 'VERIFIED'
      AND "impact_factor" >= 10
      AND COALESCE("article_type", '') !~* '(editorial|comment|letter|news|erratum|correction|case report|case reports|congress|conference abstract|study protocol)'
      THEN COALESCE("last_verified_at", "updated_at")
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" = 'LIU_BEN_LAB' THEN COALESCE("last_verified_at", "updated_at")
    ELSE "published_at"
  END,
  "pipeline_status" = CASE
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" = 'GUIDELINE'
      AND COALESCE("article_type", '') !~* '(veterinary|animal|cat|dog|feline|canine)'
      THEN 'PUBLISHED'
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" IN ('CLINICAL_RESEARCH', 'BASIC_RESEARCH')
      AND "jif_status" = 'VERIFIED'
      AND "impact_factor" >= 10
      AND COALESCE("article_type", '') !~* '(editorial|comment|letter|news|erratum|correction|case report|case reports|congress|conference abstract|study protocol)'
      THEN 'PUBLISHED'
    WHEN "verification_status" = 'VERIFIED'
      AND "specialty" = 'UROLOGY'
      AND "resource_kind" = 'LIU_BEN_LAB'
      THEN 'PUBLISHED'
    WHEN "verification_status" = 'VERIFIED' THEN 'MANUAL_REVIEW'
    WHEN "verification_status" = 'FAILED' THEN 'SOURCE_ERROR'
    ELSE 'DISCOVERED'
  END,
  "exclusion_reasons" = CASE
    WHEN "verification_status" = 'VERIFIED'
      AND "resource_kind" IN ('CLINICAL_RESEARCH', 'BASIC_RESEARCH')
      AND COALESCE("article_type", '') ~* '(editorial|comment|letter|news|erratum|correction|case report|case reports|congress|conference abstract|study protocol)'
      THEN ARRAY['excluded_publication_type']
    WHEN "verification_status" = 'VERIFIED'
      AND "resource_kind" = 'GUIDELINE'
      AND COALESCE("article_type", '') ~* '(veterinary|animal|cat|dog|feline|canine)'
      THEN ARRAY['veterinary_or_non_human_guideline']
    WHEN "verification_status" = 'VERIFIED'
      AND "resource_kind" IN ('CLINICAL_RESEARCH', 'BASIC_RESEARCH')
      AND ("jif_status" <> 'VERIFIED' OR "impact_factor" < 10)
      THEN ARRAY['jif_not_verified_or_below_threshold']
    ELSE "exclusion_reasons"
  END;

ALTER TABLE "journal_ifs"
  ADD COLUMN IF NOT EXISTS "normalized_name" TEXT,
  ADD COLUMN IF NOT EXISTS "e_issn" TEXT,
  ADD COLUMN IF NOT EXISTS "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "jif_year" INTEGER,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

UPDATE "journal_ifs"
SET
  "normalized_name" = COALESCE("normalized_name", lower(regexp_replace("journal_name", '[^[:alnum:]]+', ' ', 'g'))),
  "jif_year" = COALESCE("jif_year", 2024),
  "source" = COALESCE("source", 'local JCR whitelist'),
  "verified_at" = COALESCE("verified_at", "updated_at");

CREATE TABLE IF NOT EXISTS "harvest_runs" (
  "id" TEXT NOT NULL,
  "run_key" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "from_date" TIMESTAMP(3),
  "to_date" TIMESTAMP(3),
  "total_hits" INTEGER NOT NULL DEFAULT 0,
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "deduped_candidates" INTEGER NOT NULL DEFAULT 0,
  "metadata_verified" INTEGER NOT NULL DEFAULT 0,
  "content_reviewed" INTEGER NOT NULL DEFAULT 0,
  "jif_verified" INTEGER NOT NULL DEFAULT 0,
  "published" INTEGER NOT NULL DEFAULT 0,
  "manual_review" INTEGER NOT NULL DEFAULT 0,
  "rejected" INTEGER NOT NULL DEFAULT 0,
  "source_errors" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "errors" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "harvest_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "harvest_checkpoints" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "harvest_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_locks" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "harvest_runs_run_key_key" ON "harvest_runs"("run_key");
CREATE UNIQUE INDEX IF NOT EXISTS "harvest_checkpoints_key_key" ON "harvest_checkpoints"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "job_locks_key_key" ON "job_locks"("key");

CREATE INDEX IF NOT EXISTS "articles_pipeline_status_idx" ON "articles"("pipeline_status");
CREATE INDEX IF NOT EXISTS "articles_source_provider_source_record_id_idx" ON "articles"("source_provider", "source_record_id");
CREATE INDEX IF NOT EXISTS "journal_ifs_normalized_name_idx" ON "journal_ifs"("normalized_name");
CREATE INDEX IF NOT EXISTS "journal_ifs_issn_idx" ON "journal_ifs"("issn");
CREATE INDEX IF NOT EXISTS "journal_ifs_e_issn_idx" ON "journal_ifs"("e_issn");
CREATE INDEX IF NOT EXISTS "harvest_runs_mode_status_idx" ON "harvest_runs"("mode", "status");
CREATE INDEX IF NOT EXISTS "harvest_runs_started_at_idx" ON "harvest_runs"("started_at");
