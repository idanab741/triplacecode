/**
 * תמונת פרופיל ברירת מחדל - מוצגת לכל משתמש שלא העלה תמונת פרופיל משלו
 * (גם ברשימות, סטוריז, פוסטים, תגובות וכו').
 *
 * הקובץ עצמו נמצא ב-public/avatars/default-avatar.png כדי שיוגש כנכס
 * סטטי ישירות מה-CDN/שרת ה-Next.js.
 */
export const DEFAULT_AVATAR_URL = "/avatars/default-avatar.png";

/**
 * מחזיר את כתובת התמונה בפועל להצגה: התמונה שהמשתמש העלה אם קיימת,
 * אחרת תמונת ברירת המחדל. יש להשתמש בפונקציה הזו בכל מקום שמציג avatar,
 * במקום לבדוק avatarUrl ולהציג ראשי תיבות/אימוג'י כ-fallback.
 */
export function getAvatarUrl(avatarUrl?: string | null): string {
  return avatarUrl && avatarUrl.trim().length > 0 ? avatarUrl : DEFAULT_AVATAR_URL;
}
