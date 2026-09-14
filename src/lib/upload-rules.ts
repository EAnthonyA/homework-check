export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function validatePhotos(files: readonly File[]): void {
  if (files.length < 1 || files.length > MAX_PHOTOS) {
    throw new Error("Pasirink nuo 1 iki 3 nuotraukų.");
  }
  for (const file of files) {
    if (!file.size) throw new Error("Nuotrauka tuščia. Pasirink kitą failą.");
    if (file.size > MAX_PHOTO_BYTES) throw new Error("Viena nuotrauka gali būti iki 10 MB.");
    if (!Object.hasOwn(IMAGE_EXTENSIONS, file.type)) {
      throw new Error("Tinka JPG, PNG, WebP, GIF, HEIC arba HEIF nuotraukos.");
    }
  }
}
