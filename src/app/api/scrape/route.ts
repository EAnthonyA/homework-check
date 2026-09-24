import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runScrape } from "@/lib/scraper/run";
import { syncAllUsers, syncAssessmentsForAllUsers } from "@/lib/calendar";
import { listUnfinishedHomework, listUpcomingAssessments, getLatestScrapeRun } from "@/lib/repo";
import { vilniusDateString } from "@/lib/timezone";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const run = getLatestScrapeRun();
  return NextResponse.json({ run: run ?? null });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const result = await runScrape();
    const [homeworkSync, assessmentSync] = await Promise.all([
      syncAllUsers(listUnfinishedHomework()),
      syncAssessmentsForAllUsers(listUpcomingAssessments(vilniusDateString())),
    ]);
    return NextResponse.json({
      ok: true,
      itemsAdded: result.itemsAdded,
      itemsChanged: result.itemsChanged,
      assessmentsAdded: result.assessmentsAdded,
      assessmentsChanged: result.assessmentsChanged,
      calendarCreated: homeworkSync.created + assessmentSync.created,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
