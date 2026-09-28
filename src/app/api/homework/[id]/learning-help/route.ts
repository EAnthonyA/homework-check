import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createLearningGuidance, isAiConfigured } from "@/lib/ai";
import { getHomeworkById, getSubmission, saveLearningGuidance } from "@/lib/repo";
import { sanitizeFreeText } from "@/lib/sanitize";

const reasons = ["careless", "did-not-understand", "other"] as const;
type Reason = typeof reasons[number];

export async function POST(request: Request, ctx: RouteContext<"/api/homework/[id]/learning-help">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "kid") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isAiConfigured()) return NextResponse.json({ error: "Mokymosi pagalba dabar nepasiekiama." }, { status: 503 });

  const { id: homeworkId } = await ctx.params;
  const homework = getHomeworkById(homeworkId);
  if (!homework) return NextResponse.json({ error: "homework not found" }, { status: 404 });

  const submission = getSubmission(session.id, homeworkId);
  if (!submission || submission.ai_done !== 1 || submission.ai_correct !== 0) {
    return NextResponse.json({ error: "Pagalba galima tik prie neteisingai atlikto darbo." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = reasons.includes(body.reason as Reason) ? body.reason as Reason : null;
  const question = sanitizeFreeText(typeof body.question === "string" ? body.question : "", 600);
  if (!reason || question.length < 3) {
    return NextResponse.json({ error: "Pasirink priežastį ir trumpai parašyk, kuri dalis neaiški." }, { status: 400 });
  }

  let needsWork: string[] = [];
  try {
    const parsed: unknown = JSON.parse(submission.ai_needs_work ?? "[]");
    needsWork = Array.isArray(parsed)
      ? parsed.filter((part): part is string => typeof part === "string").map((part) => sanitizeFreeText(part, 300)).slice(0, 20)
      : [];
  } catch {
    // The short AI summary still gives the tutor enough context for older submissions.
  }

  try {
    const guidance = await createLearningGuidance({
      subject: homework.subject,
      description: homework.description,
      details: homework.details,
      needsWork: needsWork.length ? needsWork : [submission.ai_summary ?? "Peržiūrėk savo sprendimo būdą."],
      reason,
      question,
    });
    saveLearningGuidance({ userId: session.id, homeworkId, reason, question, guidance });
    return NextResponse.json({ guidance });
  } catch (error) {
    console.error("[ai] learning guidance failed:", error);
    return NextResponse.json({ error: "Nepavyko paruošti užuominos. Pabandyk dar kartą." }, { status: 502 });
  }
}
