import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUpcomingAssessments } from "@/lib/repo";
import { vilniusDateString } from "@/lib/timezone";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = vilniusDateString();
  const items = listUpcomingAssessments(date).map((assessment) => ({
    id: assessment.id,
    date: assessment.assessment_date,
    type: assessment.assessment_type,
    group: assessment.group_name,
    topic: assessment.topic,
    enteredDate: assessment.entered_date,
  }));
  return NextResponse.json({ date, items });
}
