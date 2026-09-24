import { optimizeImage } from "@/utils/imageUrl";

/**
 * תמונת פרופיל ברירת מחדל - מוצגת לכל משתמש שלא העלה תמונת פרופיל משלו
 * (גם ברשימות, סטוריז, פוסטים, תגובות וכו').
 *
 * הקובץ עצמו נמצא ב-public/avatars/default-avatar.png כדי שיוגש כנכס
 * סטטי ישירות מה-CDN/שרת ה-Next.js.
 */
export const DEFAULT_AVATAR_URL = "/avatars/default-avatar-v2.png";

/** *** בקשה מפורשת: תמונת הפרופיל הגנרית הוחלפה (אפורה במקום הכחולה). משתמש שנשמרה אצלו
 *  במפורש הכתובת של התמונה הכחולה הישנה - מקבל גם הוא את החדשה. */
const LEGACY_DEFAULT_AVATAR_URLS = ["/avatars/default-avatar.png"];

/**
 * מחזיר את כתובת התמונה בפועל להצגה: התמונה שהמשתמש העלה אם קיימת,
 * אחרת תמונת ברירת המחדל. יש להשתמש בפונקציה הזו בכל מקום שמציג avatar,
 * במקום לבדוק avatarUrl ולהציג ראשי תיבות/אימוג'י כ-fallback.
 */
/** *** ביצועים: size = גודל העיגול בפיקסלי CSS. ברירת מחדל 64 - מספיק לכל אווטאר ברשימות/פיד/תגובות
 *  (התמונה מוקטנת בשרת ל-128px ב-WebP במקום להוריד את קובץ המקור). בעמוד הפרופיל מעבירים גודל גדול. */
export function getAvatarUrl(avatarUrl?: string | null, size = 64): string {
  const url = avatarUrl?.trim();
  if (!url) return DEFAULT_AVATAR_URL;
  if (LEGACY_DEFAULT_AVATAR_URLS.some((legacy) => url === legacy || url.endsWith(legacy))) return DEFAULT_AVATAR_URL;
  return optimizeImage(url, size, { height: size, quality: 75 });
}
