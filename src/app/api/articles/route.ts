import { NextResponse } from "next/server";
import { fetchTodayCards } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const articles = await fetchTodayCards();
    return NextResponse.json({ success: true, data: articles });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
