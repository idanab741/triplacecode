/**
 * *** ביצועים (בקשה מפורשת - "התמונות לוקחות שנה להיטען"):
 * התמונות שמשתמשים מעלים נשמרות במקור - בממוצע 2.7MB ורוחב 2,240px, עד 12MB לתמונה. הפיד הציג
 * אותן כמו שהן, כך שפוסט אחד עם 4 תמונות הוריד ~11MB, ועמוד פיד שלם - עשרות MB.
 *
 * הפרויקט ב-Supabase Pro, ולכן יש Image Transformations: אותה תמונה, מוקטנת בשרת לרוחב שבאמת
 * מוצג, בפורמט WebP ובאיכות מתאימה, ונשמרת ב-CDN. תמונה בפיד יורדת מ-~2.7MB ל-~60-120KB.
 *
 * optimizeImage ממיר רק כתובות Storage ציבוריות של Supabase; כל כתובת אחרת (Google, אתרים חיצוניים,
 * קבצים מקומיים) חוזרת כמו שהיא.
 */

const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/** צפיפות מסך מקסימלית שאנחנו מכינים לה (מסכי רטינה = 2x; 3x לא מוסיף הבדל נראה לעין בתמונות). */
const DPR = 2;

export interface ImageOptions {
  /** גובה בפיקסלי CSS - רק כשרוצים חיתוך לגודל מדויק (למשל ריבוע). */
  height?: number;
  /** 20-100. ברירת מחדל 70 - הבדל בלתי מורגש מהמקור, בחלק מהמשקל. */
  quality?: number;
  /** "cover" (ברירת מחדל) חותך למילוי; "contain" משאיר את כל התמונה. */
  resize?: "cover" | "contain";
}

/** width - הרוחב בפיקסלי CSS שבו התמונה מוצגת בפועל. */
export function optimizeImage(url: string | null | undefined, width: number, options: ImageOptions = {}): string {
  if (!url) return "";
  const index = url.indexOf(OBJECT_SEGMENT);
  if (index === -1 || !/^https:\/\/[^/]+\.supabase\.co\//.test(url)) return url;

  const [base, query] = url.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("width", String(Math.round(width * DPR)));
  if (options.height) params.set("height", String(Math.round(options.height * DPR)));
  params.set("quality", String(options.quality ?? 70));
  params.set("resize", options.resize ?? "cover");

  return `${base.replace(OBJECT_SEGMENT, RENDER_SEGMENT)}?${params.toString()}`;
}
