import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUnfinishedHomework, listSubmissionsForHomework } from "@/lib/repo";
import { submissionView } from "@/lib/submission-view";
import { vilniusDateString } from "@/lib/timezone";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = vilniusDateString();
  const items = listUnfinishedHomework().map((h) => {
    const submissions = listSubmissionsForHomework(h.id);
    return {
      id: h.id,
      subject: h.subject,
      description: h.description,
      dueDate: h.due_date,
      details: h.details,
      mineDone: false,
      submissions: submissions.map(submissionView),
    };
  });

  return NextResponse.json({ date: today, items, user: session });
}
