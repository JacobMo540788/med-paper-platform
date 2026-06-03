import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const articles = await prisma.article.findMany({
    where: { verificationStatus: "VERIFIED" },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  }).catch(() => []);

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...articles.map((a) => ({
      url: `${base}/article/${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
