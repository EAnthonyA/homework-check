import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHomeworkById, upsertSubmission } from "@/lib/repo";
import { saveUpload } from "@/lib/uploads";

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
    upsertSubmission(session.id, homeworkId, imagePath);
    return NextResponse.json({ ok: true, imagePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
