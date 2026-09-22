// Local-disk image uploads (validated + sanitized filenames).
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { IMAGE_EXTENSIONS, validatePhotos } from "./upload-rules";

export function uploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./data/uploads");
}

const UPLOAD_NAME = /^[a-f0-9-]+\.(jpg|png|webp|gif|heic|heif)$/;
const DEFAULT_RETENTION_DAYS = 3;

function uploadRetentionMs(): number {
  const configuredDays = Number(process.env.UPLOAD_RETENTION_DAYS);
  const days = Number.isFinite(configuredDays) && configuredDays > 0
    ? configuredDays
    : DEFAULT_RETENTION_DAYS;
  return days * 24 * 60 * 60 * 1_000;
}

export async function saveUpload(file: File): Promise<{ imagePath: string }> {
  validatePhotos([file]);
  const ext = IMAGE_EXTENSIONS[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), bytes);
  return { imagePath: `/api/uploads/${name}` };
}

// Only used to roll back newly saved files that never became a submission.
export function discardUnsavedUploads(imagePaths: string[]): void {
  for (const imagePath of imagePaths) {
    const name = imagePath.slice("/api/uploads/".length);
    if (!imagePath.startsWith("/api/uploads/") || !UPLOAD_NAME.test(name)) continue;
    try {
      unlinkSync(path.join(uploadDir(), name));
    } catch (error) {
      console.error("[upload] could not remove uncommitted photo", error);
    }
  }
}

// Retains homework metadata and AI feedback, but removes image files after the
// configured period so long-running installations do not accumulate uploads.
export function purgeExpiredUploads(now = Date.now()): number {
  const dir = uploadDir();
  let removed = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !UPLOAD_NAME.test(entry.name)) continue;
      const imageFile = path.join(dir, entry.name);
      if (now - statSync(imageFile).mtimeMs < uploadRetentionMs()) continue;
      unlinkSync(imageFile);
      removed++;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[upload] could not purge expired photos", error);
    }
  }
  return removed;
}
