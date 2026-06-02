import { NextRequest, NextResponse } from "next/server";
import type { Specialty } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email: string; specialty?: Specialty };
  if (!body.email?.includes("@")) {
    return NextResponse.json({ success: false, error: "invalid email" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email: body.email },
    create: { email: body.email },
    update: {},
  });

  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, specialty: body.specialty ?? null },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { active: true },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        email: body.email,
        specialty: body.specialty ?? null,
        active: true,
      },
    });
  }

  return NextResponse.json({ success: true });
}
