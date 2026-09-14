// Local-disk image uploads (validated + sanitized filenames).
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { IMAGE_EXTENSIONS, validatePhotos } from "./upload-rules";

export function uploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./data/uploads");
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
    if (!imagePath.startsWith("/api/uploads/") || !/^[a-f0-9-]+\.(jpg|png|webp|gif|heic|heif)$/.test(name)) continue;
    try {
      unlinkSync(path.join(uploadDir(), name));
    } catch (error) {
      console.error("[upload] could not remove uncommitted photo", error);
    }
  }
}
