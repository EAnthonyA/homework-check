import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listHomeworkHistory, listSubmissionsForHomework } from "@/lib/repo";
import { submissionView } from "@/lib/submission-view";
import { sanitizeFreeText } from "@/lib/sanitize";
import { vilniusDateString } from "@/lib/timezone";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const items = listHomeworkHistory().map((h) => ({
    id: h.id,
    subject: h.subject,
    description: h.description,
    dueDate: h.due_date,
    doneAt: h.done_at,
    doneDate: h.done_at ? vilniusDateString(new Date(h.done_at)) : h.due_date,
    doneByName: h.done_by_name ? sanitizeFreeText(h.done_by_name, 200) : null,
    doneSource: h.done_source,
    submissions: listSubmissionsForHomework(h.id).map(submissionView),
  }));

  return NextResponse.json({ items });
}
