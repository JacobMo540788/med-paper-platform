import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 收藏功能（简化版：用 email 标识用户，生产环境应接入正式登录） */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email: string; articleId: string };
  if (!body.email || !body.articleId) {
    return NextResponse.json({ success: false, error: "email and articleId required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email: body.email },
    create: { email: body.email },
    update: {},
  });

  const fav = await prisma.favorite.upsert({
    where: { userId_articleId: { userId: user.id, articleId: body.articleId } },
    create: { userId: user.id, articleId: body.articleId },
    update: {},
  });

  return NextResponse.json({ success: true, data: fav });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ success: false, error: "email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { favorites: { include: { article: true }, orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({
    success: true,
    data: user?.favorites.map((f) => f.article) ?? [],
  });
}
