import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listHomeworkFrom, listSubmissionsForHomework } from "@/lib/repo";
import { vilniusDateString } from "@/lib/timezone";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = vilniusDateString();
  const items = listHomeworkFrom(today).map((h) => {
    const submissions = listSubmissionsForHomework(h.id);
    return {
      id: h.id,
      subject: h.subject,
      description: h.description,
      dueDate: h.due_date,
      details: h.details,
      mineDone: submissions.some((s) => s.user_id === session.id),
      submissions: submissions.map((s) => ({
        userId: s.user_id,
        userName: s.user_name,
        imagePath: s.image_path,
        createdAt: s.created_at,
      })),
    };
  });

  return NextResponse.json({ date: today, items, user: session });
}
