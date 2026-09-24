import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncAllUsers, syncAssessmentsForAllUsers } from "@/lib/calendar";
import { listUnfinishedHomework, listUpcomingAssessments } from "@/lib/repo";
import { vilniusDateString } from "@/lib/timezone";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const [homeworkSync, assessmentSync] = await Promise.all([
      syncAllUsers(listUnfinishedHomework()),
      syncAssessmentsForAllUsers(listUpcomingAssessments(vilniusDateString())),
    ]);
    return NextResponse.json({
      ok: true,
      calendarCreated: homeworkSync.created + assessmentSync.created,
      calendarFailed: homeworkSync.failed + assessmentSync.failed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
