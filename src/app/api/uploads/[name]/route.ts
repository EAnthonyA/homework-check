import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { uploadDir } from "@/lib/uploads";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[name]">) {
  const session = await getSession();
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  const { name } = await ctx.params;
  const safe = path.basename(name);
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";

  try {
    const data = await readFile(path.join(uploadDir(), safe));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
