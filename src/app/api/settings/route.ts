import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById, setCalendarEnabled } from "@/lib/repo";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = getUserById(session.id);
  return NextResponse.json({
    user: {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      calendarEnabled: Boolean(user?.calendar_enabled),
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body?.calendarEnabled === "boolean") {
    setCalendarEnabled(session.id, body.calendarEnabled);
  }

  const user = getUserById(session.id);
  return NextResponse.json({
    ok: true,
    user: {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      calendarEnabled: Boolean(user?.calendar_enabled),
    },
  });
}
