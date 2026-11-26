import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, getSubmission, commitSubmission } from "@/lib/repo";
import { saveUpload, discardUnsavedUploads, loadUpload } from "@/lib/uploads";
import { MAX_PHOTOS, validatePhotos } from "@/lib/upload-rules";
import { evaluateHomeworkSubmission, isAiConfigured, type HomeworkEvaluation } from "@/lib/ai";

function previousImagePaths(submission: ReturnType<typeof getSubmission>): string[] {
  const paths: unknown = submission?.image_paths ? JSON.parse(submission.image_paths) : submission ? [submission.image_path] : [];
  if (!Array.isArray(paths) || !paths.every((value): value is string => typeof value === "string")) throw new Error();
  return paths;
}

function validRetained(retained: FormDataEntryValue[], previous: string[], fileCount: number): retained is string[] {
  return retained.every((value): value is string => typeof value === "string" && previous.includes(value))
    && new Set(retained).size === retained.length
    && retained.length + fileCount <= MAX_PHOTOS
    && retained.length + fileCount > 0;
}

async function readSelection(request: Request, userId: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const homeworkId = String(form.get("homeworkId") ?? "");
  const files = form.getAll("file");
  const retained = form.getAll("retained");
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
  const submission = getSubmission(userId, homeworkId);
  let previousPaths: string[] = [];
  try {
    previousPaths = previousImagePaths(submission);
  } catch {
    return NextResponse.json({ error: "Ankstesnių nuotraukų perskaityti nepavyko." }, { status: 409 });
  }
  if (!validRetained(retained, previousPaths, files.length)) {
    return NextResponse.json({ error: "Pasirink tinkamas nuotraukas." }, { status: 400 });
  }
  try {
    if (files.length) validatePhotos(files);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Netinkamos nuotraukos." }, { status: 400 });
  }
  return { homeworkId, homework, submission, retained, files };
}

async function evaluateSelection(
  homework: NonNullable<ReturnType<typeof getHomeworkById>>,
  images: Array<{ imageBytes: Uint8Array; mimeType: string }>,
): Promise<{ ai: HomeworkEvaluation | null; aiError: string | null }> {
  if (!isAiConfigured()) return { ai: null, aiError: null };
  try {
    const ai = await evaluateHomeworkSubmission({
      images, subject: homework.subject, description: homework.description, details: homework.details,
    });
    return { ai, aiError: null };
  } catch (error) {
    console.error("[ai] homework evaluation failed:", error);
    return { ai: null, aiError: "Nepavyko įvertinti nuotraukų. Jas gali peržiūrėti tėvai arba gali pateikti dar kartą." };
  }
}

function submissionResponse(imagePaths: string[], ai: HomeworkEvaluation | null, aiError: string | null) {
  return NextResponse.json({
    ok: true,
    imagePath: imagePaths[0],
    imagePaths,
    completed: ai?.done === true && ai.correct === true,
    ai: ai
      ? { done: ai.done, correct: ai.correct, canVerifyCorrectness: ai.canVerifyCorrectness, needsClearerPhoto: ai.needsClearerPhoto, summary: ai.summary, goodParts: ai.goodParts, needsWork: ai.needsWork }
      : null,
    aiError,
  });
}

function saveEvaluation(
  selection: Exclude<Awaited<ReturnType<typeof readSelection>>, NextResponse>,
  userId: string,
  imagePaths: string[],
  ai: HomeworkEvaluation | null,
  aiError: string | null,
): boolean {
  const evaluation = ai ? {
    aiDone: ai.done,
    aiCorrect: ai.correct,
    aiCanVerifyCorrectness: ai.canVerifyCorrectness,
    aiNeedsClearerPhoto: ai.needsClearerPhoto,
    aiSummary: ai.summary,
    aiGoodParts: ai.goodParts,
    aiNeedsWork: ai.needsWork,
    aiDebug: JSON.stringify(ai.debug),
  } : {};
  return commitSubmission({
    userId,
    homeworkId: selection.homeworkId,
    imagePaths,
    expectedRevision: selection.submission?.revision ?? null,
    ...evaluation,
    aiError,
    aiEvaluatedAt: ai || aiError ? new Date().toISOString() : null,
  }, selection.homework.completion_version);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const selection = await readSelection(request, session.id);
  if (selection instanceof NextResponse) return selection;
  const { homework, retained, files } = selection;

  const savedPaths: string[] = [];
  const imagePaths: string[] = [...retained];
  let committed = false;
  try {
    for (const file of files) {
      const { imagePath } = await saveUpload(file);
      imagePaths.push(imagePath);
      savedPaths.push(imagePath);
    }

    const retainedImages = [];
    for (const [index, imagePath] of retained.entries()) {
      try {
        retainedImages.push(await loadUpload(imagePath));
      } catch {
        return NextResponse.json({ error: `Išsaugota ${index + 1} nuotrauka nepasiekiama. Pašalink ją ir pridėk iš naujo.` }, { status: 409 });
      }
    }

    // Evaluate every page together as one submission.
    const newImages = await Promise.all(files.map(async (file) => ({
      imageBytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    })));
    const { ai, aiError } = await evaluateSelection(homework, [...retainedImages, ...newImages]);

    committed = saveEvaluation(selection, session.id, imagePaths, ai, aiError);
    if (!committed) {
      return NextResponse.json({ error: "Darbo būsena pasikeitė vertinant. Atnaujink puslapį prieš pateikdamas dar kartą." }, { status: 409 });
    }

    // AI approval requires a complete *and* correct solution. Incorrect or
    // unverifiable work stays active with its photos and feedback for a retry.
    return submissionResponse(imagePaths, ai, aiError);
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      { error: "Nepavyko išsaugoti nuotraukų. Bandyk dar kartą." },
      { status: 500 },
    );
  } finally {
    if (!committed) discardUnsavedUploads(savedPaths);
  }
}
