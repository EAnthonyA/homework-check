import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listMessageAttachments, listUnreadMessages } from "@/lib/repo";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    items: listUnreadMessages(session.id).map((message) => ({
      id: message.id,
      sender: message.sender,
      subject: message.subject,
      body: message.body,
      receivedAt: message.received_at,
      attachments: listMessageAttachments(message.id).map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        href: `/api/messages/${message.id}/attachments/${attachment.id}`,
      })),
    })),
  });
}
