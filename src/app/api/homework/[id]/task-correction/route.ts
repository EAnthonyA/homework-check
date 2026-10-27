import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { evaluateHomeworkImages, isAiConfigured } from "@/lib/ai";
import { getHomeworkById, getSubmission, commitSubmission } from "@/lib/repo";
import { sanitizeFreeText } from "@/lib/sanitize";
import { uploadDir } from "@/lib/uploads";

const uploadName = /^[a-f0-9-]+\.(jpg|png|webp|gif|heic|heif)$/;
const mimeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
};

function submissionImagePaths(imagePaths: string | null, imagePath: string): string[] {
  try {
    const parsed: unknown = imagePaths ? JSON.parse(imagePaths) : [imagePath];
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

async function loadSubmissionImages(imagePaths: string[]) {
  return Promise.all(imagePaths.map(async (imagePath) => {
    const name = imagePath.startsWith("/api/uploads/") ? imagePath.slice("/api/uploads/".length) : "";
    if (!uploadName.test(name)) throw new Error("invalid upload path");
    const extension = path.extname(name).toLowerCase();
    const mimeType = mimeByExtension[extension];
    if (!mimeType) throw new Error("unsupported upload type");
    return { imageBytes: new Uint8Array(await readFile(path.join(uploadDir(), name))), mimeType };
  }));
}

export async function POST(request: Request, ctx: RouteContext<"/api/homework/[id]/task-correction">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "kid") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isAiConfigured()) return NextResponse.json({ error: "AI vertinimas dabar nepasiekiamas." }, { status: 503 });

  const { id: homeworkId } = await ctx.params;
  const homework = getHomeworkById(homeworkId);
  const submission = getSubmission(session.id, homeworkId);
  if (!homework || !submission) return NextResponse.json({ error: "Darbo pateikimas nerastas." }, { status: 404 });
  if (homework.done_at) return NextResponse.json({ error: "Darbas jau pažymėtas kaip atliktas." }, { status: 409 });
  if (submission.ai_done !== 1 || submission.ai_correct !== 0) {
    return NextResponse.json({ error: "Sąlygą galima patikslinti tik po AI pažymėtos klaidos." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const taskText = sanitizeFreeText(typeof body.taskText === "string" ? body.taskText : "", 2_000);
  if (taskText.length < 3) return NextResponse.json({ error: "Įrašyk visą užduoties sąlygą." }, { status: 400 });

  const imagePaths = submissionImagePaths(submission.image_paths, submission.image_path);
  if (!imagePaths.length) return NextResponse.json({ error: "Pateiktų nuotraukų nebėra." }, { status: 409 });

  try {
    const ai = await evaluateHomeworkImages({
      images: await loadSubmissionImages(imagePaths),
      subject: homework.subject,
      description: homework.description,
      details: [homework.details, `Rankiniu būdu patikslinta užduoties sąlyga: ${taskText}`].filter(Boolean).join("\n"),
    });
    const committed = commitSubmission({
      userId: session.id,
      homeworkId,
      imagePaths,
      aiDone: ai.done,
      aiCorrect: ai.correct,
      aiCanVerifyCorrectness: ai.canVerifyCorrectness,
      aiNeedsClearerPhoto: ai.needsClearerPhoto,
      aiSummary: ai.correct === true
        ? "AI patikrino pagal ranka įvestą sąlygą. Tėvai, peržiūrėkite prieš žymėdami darbą atliktu."
        : ai.summary,
      aiGoodParts: ai.goodParts,
      aiNeedsWork: ai.needsWork,
      aiDebug: JSON.stringify(ai.debug),
      manualTaskText: taskText,
      aiUsedManualTask: true,
      aiEvaluatedAt: new Date().toISOString(),
    }, homework.completion_version);
    if (!committed) return NextResponse.json({ error: "Darbo būsena pasikeitė. Atnaujink puslapį." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ai] corrected task evaluation failed:", error);
    return NextResponse.json({ error: "Nepavyko patikrinti pagal patikslintą sąlygą. Bandyk dar kartą." }, { status: 502 });
  }
}
