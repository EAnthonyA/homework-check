import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { homeworkQualityReport } from "@/lib/repo";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return NextResponse.json(homeworkQualityReport(since));
}
