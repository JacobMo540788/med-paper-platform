import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Specialty library API is deprecated. Use /api/resources for urology resources.",
    },
    { status: 410 }
  );
}
