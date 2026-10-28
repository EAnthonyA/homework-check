import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createStartingHelp, isAiConfigured } from "@/lib/ai";
import { getHomeworkById } from "@/lib/repo";
import { sanitizeFreeText } from "@/lib/sanitize";
import { validatePhotos } from "@/lib/upload-rules";
import { parseHelpHistory } from "@/lib/starting-help-history";

export async function POST(request: Request, ctx: RouteContext<"/api/homework/[id]/start-help">) {
  const session = await getSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (session.role !== "kid") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const homework = getHomeworkById(id);

  if (!homework) return NextResponse.json({ error: "homework not found" }, { status: 404 });

  if (homework.done_at) return NextResponse.json({ error: "Darbas jau atliktas." }, { status: 409 });

  if (!isAiConfigured()) return NextResponse.json({ error: "Pagalba dabar nepasiekiama. Gali paprašyti tėvų pagalbos." }, { status: 503 });

  const form = await request.formData().catch(() => null);

  if (!form) return NextResponse.json({ error: "Netinkami duomenys." }, { status: 400 });

  const mode = form.get("mode");

  if (mode !== "breakdown" && mode !== "explain" && mode !== "example" && mode !== "start" && mode !== "followup") {
    return NextResponse.json({ error: "Pasirink, kokios pagalbos reikia." }, { status: 400 });
  }

  const files = form.getAll("photo");

  if (files.length > 1 || !files.every((file): file is File => file instanceof File)) return NextResponse.json({ error: "Pasirink vieną nuotrauką." }, { status: 400 });

  try {
    if (files.length) validatePhotos(files);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Netinkama nuotrauka." }, { status: 400 });
  }

  const field = (key: string, max: number) => sanitizeFreeText(typeof form.get(key) === "string" ? form.get(key) as string : "", max);

  try {
    const result = await createStartingHelp({
      subject: homework.subject,
      description: homework.description,
      details: homework.details,
      mode,
      part: field("part", 600),
      question: field("question", 600),
      history: parseHelpHistory(form.get("history")),
      image: files[0] ? { imageBytes: new Uint8Array(await files[0].arrayBuffer()), mimeType: files[0].type } : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai] starting help failed:", error);

    return NextResponse.json({ error: "Nepavyko paruošti pagalbos. Bandyk dar kartą arba paprašyk tėvų." }, { status: 502 });
  }
}
