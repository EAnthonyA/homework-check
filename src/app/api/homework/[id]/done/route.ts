import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, markHomeworkDone } from "@/lib/repo";
import { removeHomeworkFromCalendars } from "@/lib/calendar";

export async function POST(_req: Request, ctx: RouteContext<"/api/homework/[id]/done">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const item = getHomeworkById(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  markHomeworkDone(id, session.id);
  const removed = await removeHomeworkFromCalendars(id);

  return NextResponse.json({ ok: true, calendarRemoved: removed.deleted });
}
