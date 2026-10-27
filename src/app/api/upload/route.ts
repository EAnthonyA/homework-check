import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, commitSubmission } from "@/lib/repo";
import { saveUpload, discardUnsavedUploads } from "@/lib/uploads";
import { validatePhotos } from "@/lib/upload-rules";
import { evaluateHomeworkImages, isAiConfigured, verifyIncorrectHomeworkImages, type HomeworkEvaluation } from "@/lib/ai";

function normalizePart(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function sameIncorrectParts(first: HomeworkEvaluation, second: HomeworkEvaluation): boolean {
  const incorrectParts = (evaluation: HomeworkEvaluation) => evaluation.debug.checks
    .filter((check) => check.verdict === "incorrect")
    .map((check) => normalizePart(check.part))
    .filter(Boolean)
    .sort();
  const a = incorrectParts(first);
  const b = incorrectParts(second);
  return a.length > 0 && a.length === b.length && a.every((part, index) => part === b[index]);
}

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
    let ai: HomeworkEvaluation | null = null;
    let aiError: string | null = null;
    if (isAiConfigured()) {
      try {
        const evaluationInput = {
          images: await Promise.all(files.map(async (file) => ({
            imageBytes: new Uint8Array(await file.arrayBuffer()),
            mimeType: file.type,
          }))),
          subject: homework.subject,
          description: homework.description,
          details: homework.details,
        };
        ai = await evaluateHomeworkImages(evaluationInput);

        // A child should never be asked to redo work based on one potentially
        // mistaken OCR read. A second model must independently flag the same
        // parts before an incorrect verdict is kept.
        if (ai.done && ai.correct === false) {
          try {
            const verification = await verifyIncorrectHomeworkImages(evaluationInput);
            if (!(verification.done && verification.canVerifyCorrectness && verification.correct === false && sameIncorrectParts(ai, verification))) {
              const verifierCouldRead = verification.done && verification.canVerifyCorrectness && verification.correct !== null;
              ai = {
                ...ai,
                correct: null,
                needsClearerPhoto: !verifierCouldRead,
                summary: verifierCouldRead
                  ? "Du nepriklausomi AI vertinimai nesutapo. Nuotraukos išsaugotos tėvų peržiūrai — vaiko taisyti neprašoma."
                  : "Negaliu patikimai patvirtinti klaidos — įkelk tiesią, stambią užduoties nuotrauką, kad aiškiai matytųsi visi skaičiai ir raidės.",
                goodParts: [],
                needsWork: [],
                debug: {
                  ...ai.debug,
                  verificationRawResponse: verification.debug.rawResponse,
                  notes: [...ai.debug.notes, `Pakartotinis patikrinimas (${verification.debug.model}) nepatvirtino tų pačių klaidų.`].slice(0, 10),
                },
              };
            }
          } catch (error) {
            console.error("[ai] homework verification failed:", error);
            ai = {
              ...ai,
              correct: null,
              needsClearerPhoto: true,
              summary: "Nepavyko patikimai patvirtinti klaidos — įkelk tiesią, stambią užduoties nuotrauką, kad aiškiai matytųsi visi skaičiai ir raidės.",
              goodParts: [],
              needsWork: [],
              debug: {
                ...ai.debug,
                notes: [...ai.debug.notes, `Pakartotinis AI patikrinimas nepasiekiamas: ${error instanceof Error ? error.message : "nežinoma klaida"}`].slice(0, 10),
              },
            };
          }
        }
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
      aiCanVerifyCorrectness: ai?.canVerifyCorrectness ?? null,
      aiNeedsClearerPhoto: ai?.needsClearerPhoto ?? null,
      aiSummary: ai?.summary ?? null,
      aiGoodParts: ai?.goodParts,
      aiNeedsWork: ai?.needsWork,
      aiDebug: ai ? JSON.stringify(ai.debug) : null,
      aiError,
      aiEvaluatedAt,
    }, homework.completion_version);
    if (!committed) {
      return NextResponse.json({ error: "Darbo būsena pasikeitė vertinant. Atnaujink puslapį prieš pateikdamas dar kartą." }, { status: 409 });
    }

    // AI approval requires a complete *and* correct solution. Incorrect or
    // unverifiable work stays active with its photos and feedback for a retry.
    const completed = ai?.done === true && ai.correct === true;
    return NextResponse.json({
      ok: true,
      imagePath: imagePaths[0],
      imagePaths,
      completed,
      ai: ai
        ? { done: ai.done, correct: ai.correct, canVerifyCorrectness: ai.canVerifyCorrectness, needsClearerPhoto: ai.needsClearerPhoto, summary: ai.summary, goodParts: ai.goodParts, needsWork: ai.needsWork }
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
