"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Specialty, StudyType } from "@prisma/client";
import { SPECIALTY_CONFIG, STUDY_TYPE_LABEL } from "@/lib/constants";
import { PublicationDate } from "./publication-date";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";
import type { ArticleCardDTO } from "@/lib/types";

export function ArticleCard({ article, index = 0 }: { article: ArticleCardDTO; index?: number }) {
  const spec = SPECIALTY_CONFIG[article.specialty as Specialty];
  const studyLabel = STUDY_TYPE_LABEL[article.studyType as StudyType];
  const recommendLabel =
    article.recommendSource === "daily_new"
      ? "今日新文献"
      : article.recommendSource === "historical"
        ? "历史高分文献"
        : article.recommendSource === "core"
          ? "核心文献重读"
          : null;
  const articleTypeLabel = article.articleType?.split(";")[0]?.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <Link href={`/article/${article.id}`}>
        <Card className="group h-full transition-shadow hover:shadow-lg">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {recommendLabel && <Badge>{recommendLabel}</Badge>}
              <Badge variant="secondary">{spec.label}</Badge>
              <Badge variant={article.studyType === "CLINICAL" ? "clinical" : "basic"}>
                {studyLabel}
              </Badge>
              {articleTypeLabel && <Badge variant="outline">{articleTypeLabel}</Badge>}
              <Badge variant="outline">IF {article.impactFactor.toFixed(1)}</Badge>
            </div>
            <h2 className="font-serif text-lg font-semibold leading-snug group-hover:text-primary">
              {article.titleEn}
            </h2>
            {article.titleCn && (
              <p className="text-sm text-muted-foreground">{article.titleCn}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium text-foreground/90">{article.journal}</p>
            <PublicationDate date={article.publishDate} />
            {article.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.keywords.slice(0, 4).map((kw) => (
                  <span key={kw} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            )}
            {article.aiSummary && (
              <p className="border-l-2 border-primary/40 pl-3 italic text-foreground/80">
                {article.aiSummary}
              </p>
            )}
            {article.recommendationReason && (
              <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                推荐理由：{article.recommendationReason}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
