import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMessageById, markMessageRead } from "@/lib/repo";

export async function POST(_request: Request, context: RouteContext<"/api/messages/[id]/read">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!getMessageById(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  markMessageRead(session.id, id);
  return NextResponse.json({ ok: true });
}
