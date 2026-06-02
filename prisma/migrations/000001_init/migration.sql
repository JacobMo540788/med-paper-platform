-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('ONCOLOGY_COLORECTAL', 'OPHTHALMOLOGY', 'GASTROENTEROLOGY', 'UROLOGY', 'NEPHROLOGY');

-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('BASIC', 'CLINICAL');

-- CreateEnum
CREATE TYPE "ArticleSource" AS ENUM ('PUBMED', 'EUROPE_PMC', 'CROSSREF', 'SEED');

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_cn" TEXT,
    "abstract" TEXT,
    "abstract_cn" TEXT,
    "journal" TEXT NOT NULL,
    "impact_factor" DOUBLE PRECISION NOT NULL,
    "doi" TEXT,
    "pmid" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publish_date" TIMESTAMP(3) NOT NULL,
    "specialty" "Specialty" NOT NULL,
    "study_type" "StudyType" NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords_bilingual" JSONB,
    "article_type" TEXT,
    "ai_summary" TEXT,
    "ai_analysis_json" JSONB,
    "is_landmark" BOOLEAN NOT NULL DEFAULT false,
    "is_today_pick" BOOLEAN NOT NULL DEFAULT false,
    "featured_date_key" TEXT,
    "is_in_history" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "is_core_library" BOOLEAN NOT NULL DEFAULT false,
    "core_added_at" TIMESTAMP(3),
    "source" "ArticleSource" NOT NULL DEFAULT 'PUBMED',
    "external_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialty" "Specialty",
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fetch_logs" (
    "id" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specialty" "Specialty",
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "fallback" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "fetch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_ifs" (
    "id" TEXT NOT NULL,
    "journal_name" TEXT NOT NULL,
    "issn" TEXT,
    "impact_factor" DOUBLE PRECISION NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "is_top_journal" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_ifs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_doi_key" ON "articles"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "articles_pmid_key" ON "articles"("pmid");

-- CreateIndex
CREATE INDEX "articles_specialty_publish_date_idx" ON "articles"("specialty", "publish_date");

-- CreateIndex
CREATE INDEX "articles_impact_factor_idx" ON "articles"("impact_factor");

-- CreateIndex
CREATE INDEX "articles_is_today_pick_idx" ON "articles"("is_today_pick");

-- CreateIndex
CREATE INDEX "articles_featured_date_key_idx" ON "articles"("featured_date_key");

-- CreateIndex
CREATE INDEX "articles_is_in_history_specialty_idx" ON "articles"("is_in_history", "specialty");

-- CreateIndex
CREATE INDEX "articles_is_core_library_specialty_idx" ON "articles"("is_core_library", "specialty");

-- CreateIndex
CREATE INDEX "articles_study_type_idx" ON "articles"("study_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_article_id_key" ON "favorites"("user_id", "article_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_ifs_journal_name_key" ON "journal_ifs"("journal_name");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

