// Local-disk image uploads (validated + sanitized filenames).
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function uploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./data/uploads");
}

export async function saveUpload(file: File): Promise<{ imagePath: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large (maximum 10 MB)");
  }
  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), bytes);
  return { imagePath: `/uploads/${name}` };
}
