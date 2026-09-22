import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, commitSubmission } from "@/lib/repo";
import { saveUpload, discardUnsavedUploads } from "@/lib/uploads";
import { validatePhotos } from "@/lib/upload-rules";
import { evaluateHomeworkImages, isAiConfigured } from "@/lib/ai";
import { removeHomeworkFromCalendars } from "@/lib/calendar";

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
  const files = form.getAll("file");
  if (!homeworkId || !files.every((file): file is File => file instanceof File)) {
    return NextResponse.json({ error: "homeworkId and file are required" }, { status: 400 });
  }

  const homework = getHomeworkById(homeworkId);
  if (!homework) {
    return NextResponse.json({ error: "homework not found" }, { status: 404 });
  }
  if (homework.done_at) {
    return NextResponse.json({ error: "Darbas jau pažymėtas kaip atliktas. Pirmiausia tėvai turi jį grąžinti taisyti." }, { status: 409 });
  }
  try {
    validatePhotos(files);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Netinkamos nuotraukos." }, { status: 400 });
  }

  const imagePaths: string[] = [];
  let committed = false;
  try {
    for (const file of files) {
      const { imagePath } = await saveUpload(file);
      imagePaths.push(imagePath);
    }

    // Evaluate every page together as one submission.
    let ai: { done: boolean; correct: boolean | null; summary: string } | null = null;
    let aiError: string | null = null;
    if (isAiConfigured()) {
      try {
        ai = await evaluateHomeworkImages({
          images: await Promise.all(files.map(async (file) => ({
            imageBytes: new Uint8Array(await file.arrayBuffer()),
            mimeType: file.type,
          }))),
          subject: homework.subject,
          description: homework.description,
          details: homework.details,
        });
      } catch (err) {
        aiError = "Nepavyko įvertinti nuotraukų. Jas gali peržiūrėti tėvai arba gali pateikti dar kartą.";
        console.error("[ai] homework evaluation failed:", err);
      }
    }

    const aiEvaluatedAt = ai || aiError ? new Date().toISOString() : null;
    committed = commitSubmission({
      userId: session.id,
      homeworkId,
      imagePaths,
      aiDone: ai?.done ?? null,
      aiCorrect: ai?.correct ?? null,
      aiSummary: ai?.summary ?? null,
      aiError,
      aiEvaluatedAt,
    }, homework.completion_version);
    if (!committed) {
      return NextResponse.json({ error: "Darbo būsena pasikeitė vertinant. Atnaujink puslapį prieš pateikdamas dar kartą." }, { status: 409 });
    }

    // AI approval requires a complete *and* correct solution. Incorrect or
    // unverifiable work stays active with its photos and feedback for a retry.
    const completed = ai?.done === true && ai.correct === true;
    let calendarFailed = 0;
    if (completed) {
      try {
        calendarFailed = (await removeHomeworkFromCalendars(homeworkId)).failed;
      } catch (error) {
        console.error("[calendar] could not remove completed homework:", error);
        calendarFailed = 1;
      }
    }

    return NextResponse.json({
      ok: true,
      imagePath: imagePaths[0],
      imagePaths,
      completed,
      calendarFailed,
      ai: ai
        ? { done: ai.done, correct: ai.correct, summary: ai.summary }
        : null,
      aiError,
    });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      { error: "Nepavyko išsaugoti nuotraukų. Bandyk dar kartą." },
      { status: 500 },
    );
  } finally {
    if (!committed) discardUnsavedUploads(imagePaths);
  }
}
