import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, upsertSubmission } from "@/lib/repo";
import { saveUpload } from "@/lib/uploads";
import { evaluateHomeworkImage, isAiConfigured } from "@/lib/ai";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const homeworkId = String(form.get("homeworkId") ?? "");
  const file = form.get("file");
  if (!homeworkId || !(file instanceof File)) {
    return NextResponse.json({ error: "homeworkId and file are required" }, { status: 400 });
  }

  const homework = getHomeworkById(homeworkId);
  if (!homework) {
    return NextResponse.json({ error: "homework not found" }, { status: 404 });
  }

  try {
    const { imagePath } = await saveUpload(file);

    // Ask the AI to judge whether the photo shows the task done (and correct).
    let ai: { done: boolean; correct: boolean | null; summary: string } | null = null;
    let aiError: string | null = null;
    if (isAiConfigured()) {
      try {
        ai = await evaluateHomeworkImage({
          imageBytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type,
          subject: homework.subject,
          description: homework.description,
          details: homework.details,
        });
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
        console.error("[ai] homework evaluation failed:", aiError);
      }
    }

    const aiEvaluatedAt = ai || aiError ? new Date().toISOString() : null;
    upsertSubmission({
      userId: session.id,
      homeworkId,
      imagePath,
      aiDone: ai?.done ?? null,
      aiCorrect: ai?.correct ?? null,
      aiSummary: ai?.summary ?? null,
      aiError,
      aiEvaluatedAt,
    });

    return NextResponse.json({
      ok: true,
      imagePath,
      ai: ai
        ? { done: ai.done, correct: ai.correct, summary: ai.summary }
        : null,
      aiError,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
