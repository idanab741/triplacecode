/**
 * *** ביצועים: מקטין תמונה בדפדפן *לפני* ההעלאה - צילום מהטלפון (3-12MB) הופך ל-~300-600KB.
 * ההעלאה עצמה מהירה פי כמה, וגם הצפייה (optimizeImage) מתחילה ממקור קטן יותר.
 *  - הצלע הארוכה מוגבלת ל-maxDimension (ברירת מחדל 2048 - חד גם במסך מלא).
 *  - JPEG באיכות 0.82.
 *  - תמונה שכבר קטנה, GIF, וידאו, או פורמט שהדפדפן לא יודע לפענח (למשל HEIC בכרום) - חוזרת כמו שהיא,
 *    כך שהעלאה לעולם לא נכשלת בגלל הדחיסה.
 */
export async function compressImageFile(file: File, maxDimension = 2048, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < 400 * 1024) return file;

  try {
    const bitmap = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap.source, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** createImageBitmap מכבד את כיוון התמונה (EXIF) - בלי זה צילומי טלפון יוצאים מסובבים. */
async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}
