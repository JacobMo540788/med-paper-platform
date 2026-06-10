ALTER TABLE "articles"
ADD COLUMN "last_recommended_at" TIMESTAMP(3),
ADD COLUMN "recommend_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "recommend_source" TEXT;

CREATE TABLE "daily_recommendations" (
  "id" TEXT NOT NULL,
  "article_id" TEXT NOT NULL,
  "recommendation_date" TIMESTAMP(3) NOT NULL,
  "date_key" TEXT NOT NULL,
  "specialty" "Specialty" NOT NULL,
  "recommend_source" TEXT NOT NULL,
  "reason" TEXT,
  "score" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "daily_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_recommendations_date_key_key" ON "daily_recommendations"("date_key");
CREATE INDEX "daily_recommendations_article_id_idx" ON "daily_recommendations"("article_id");
CREATE INDEX "daily_recommendations_specialty_idx" ON "daily_recommendations"("specialty");
CREATE INDEX "daily_recommendations_recommend_source_idx" ON "daily_recommendations"("recommend_source");
CREATE INDEX "articles_last_recommended_at_idx" ON "articles"("last_recommended_at");
CREATE INDEX "articles_recommend_source_idx" ON "articles"("recommend_source");

ALTER TABLE "daily_recommendations"
ADD CONSTRAINT "daily_recommendations_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
