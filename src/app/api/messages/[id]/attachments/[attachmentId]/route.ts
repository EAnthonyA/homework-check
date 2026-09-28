import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMessageAttachment } from "@/lib/repo";
import { CookieJar } from "@/lib/scraper/cookie-jar";
import { fetchMessageAttachment, login } from "@/lib/scraper/source";

export async function GET(_request: Request, context: RouteContext<"/api/messages/[id]/attachments/[attachmentId]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, attachmentId } = await context.params;
  const attachment = getMessageAttachment(id, attachmentId);
  if (!attachment) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const jar = new CookieJar();
    await login(jar);
    const source = await fetchMessageAttachment(jar, attachment.source_path);
    if (!source.body) return NextResponse.json({ error: "attachment unavailable" }, { status: 502 });
    return new Response(source.body, {
      headers: {
        "content-type": source.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[messages] attachment download failed:", error);
    return NextResponse.json({ error: "attachment unavailable" }, { status: 502 });
  }
}
