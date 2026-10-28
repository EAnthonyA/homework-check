import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteHomeworkHelpRequest, getHomeworkById, saveHomeworkHelpRequest } from "@/lib/repo";
import { sanitizeFreeText } from "@/lib/sanitize";

export async function POST(request: Request, ctx: RouteContext<"/api/homework/[id]/help-request">) {
  const session = await getSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (session.role !== "kid") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const homework = getHomeworkById(id);

  if (!homework) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (homework.done_at) return NextResponse.json({ error: "Darbas jau atliktas." }, { status: 409 });

  const input: unknown = await request.json().catch(() => ({}));
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};

  saveHomeworkHelpRequest(session.id, id,
    sanitizeFreeText(typeof body.part === "string" ? body.part : "", 600),
    sanitizeFreeText(typeof body.question === "string" ? body.question : "", 600));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/homework/[id]/help-request">) {
  const session = await getSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (session.role !== "kid") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  deleteHomeworkHelpRequest(session.id, id);

  return NextResponse.json({ ok: true });
}
