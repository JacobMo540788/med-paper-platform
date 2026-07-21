"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { Specialty, StudyType } from "@prisma/client";
import { SPECIALTY_CONFIG, STUDY_TYPE_LABEL, RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/constants";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ArticleCardDTO } from "@/lib/types";

function jifLabel(article: ArticleCardDTO) {
  if (article.jifStatus === "NOT_APPLICABLE") return "IF 不适用";
  if (article.jifStatus === "PENDING") return "IF 待核验";
  return `IF ${article.impactFactor.toFixed(1)}${article.jifYear ? ` · ${article.jifYear}` : ""}`;
}

export function ArticleCard({ article, index = 0 }: { article: ArticleCardDTO; index?: number }) {
  const spec = SPECIALTY_CONFIG[article.specialty as Specialty];
  const studyLabel = STUDY_TYPE_LABEL[article.studyType as StudyType];
  const resourceKind = article.resourceKind as ResourceKind | undefined;
  const resourceLabel = resourceKind ? RESOURCE_KIND_LABEL[resourceKind] : null;
  const articleTypeLabel = article.articleType?.split(";")[0]?.trim();
  const venue = article.organization ?? article.journal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/article/${article.id}`} className="block h-full">
        <Card className="group h-full transition-shadow hover:shadow-lg">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {resourceLabel && <Badge>{resourceLabel}</Badge>}
              <Badge variant="secondary">{spec.label}</Badge>
              <Badge variant={article.studyType === "CLINICAL" ? "clinical" : "basic"}>
                {studyLabel}
              </Badge>
              {article.diseaseArea && <Badge variant="outline">{article.diseaseArea}</Badge>}
              {articleTypeLabel && <Badge variant="outline">{articleTypeLabel}</Badge>}
              <Badge variant="outline">{jifLabel(article)}</Badge>
            </div>
            <h2 className="font-serif text-lg font-semibold leading-snug group-hover:text-primary">
              {article.titleCn ?? article.titleEn}
            </h2>
            {article.titleCn && <p className="line-clamp-2 text-sm text-muted-foreground">{article.titleEn}</p>}
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-1">
              <span>{venue}</span>
              <span>{new Date(article.publishDate).toLocaleDateString("zh-CN")}</span>
              {article.firstAuthor && <span>第一作者：{article.firstAuthor}</span>}
              {(article.doi || article.pmid) && (
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {article.doi ? `DOI ${article.doi}` : `PMID ${article.pmid}`}
                </span>
              )}
            </div>

            {article.aiSummary && <p className="line-clamp-3 leading-relaxed">{article.aiSummary}</p>}
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
