import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { RESOURCE_NAV, UROLOGY_SPECIALTY } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const articles = await prisma.article
    .findMany({
      where: { specialty: UROLOGY_SPECIALTY, verificationStatus: "VERIFIED" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    })
    .catch(() => []);

  return [
    ...RESOURCE_NAV.map((item) => ({
      url: `${base}${item.href === "/" ? "" : item.href}`,
      lastModified: new Date(),
      changeFrequency: item.href === "/" ? ("daily" as const) : ("weekly" as const),
      priority: item.href === "/" ? 1 : 0.8,
    })),
    ...articles.map((a) => ({
      url: `${base}/article/${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
