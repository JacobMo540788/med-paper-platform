-- CreateEnum
CREATE TYPE "ArticleVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "articles"
  ADD COLUMN "source_provider" TEXT,
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "verification_status" "ArticleVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verification_error" TEXT,
  ADD COLUMN "last_verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "articles_verification_status_idx" ON "articles"("verification_status");
