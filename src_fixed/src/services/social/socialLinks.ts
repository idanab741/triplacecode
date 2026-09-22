/** קישורי רשתות חברתיות בפרופיל (Instagram / TikTok) - משותף ל-server ול-client.
 *  ב-DB נשמר רק ה-handle (migration 0091); הקישור נבנה כאן. */

export type SocialPlatform = "instagram" | "tiktok";

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

export const SOCIAL_LABELS: Record<SocialPlatform, { name: string; add: string }> = {
  instagram: { name: "אינסטגרם", add: "הוסף אינסטגרם" },
  tiktok: { name: "טיקטוק", add: "הוסף טיקטוק" },
};

const HANDLE_RE: Record<SocialPlatform, RegExp> = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
};

/** מנרמל קלט חופשי ל-handle: "@name", "name", או קישור מלא (instagram.com/name, tiktok.com/@name).
 *  מחזיר null לקלט ריק (= הסרה). זורק Error עם הודעה בעברית לקלט לא תקין. */
export function normalizeSocialHandle(platform: SocialPlatform, raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim();
  if (!value) return null;

  if (/[/.]/.test(value) && /(instagram\.com|tiktok\.com|^https?:)/i.test(value)) {
    const path = value.replace(/^https?:\/\/(www\.)?/i, "").replace(/^(instagram\.com|tiktok\.com)\/?/i, "");
    value = path.split(/[/?#]/)[0] ?? "";
  }
  value = value.replace(/^@+/, "");

  if (!HANDLE_RE[platform].test(value)) {
    throw new Error(
      platform === "instagram"
        ? "שם משתמש באינסטגרם: עד 30 תווים - אותיות באנגלית, ספרות, נקודה וקו תחתון"
        : "שם משתמש בטיקטוק: 2-24 תווים - אותיות באנגלית, ספרות, נקודה וקו תחתון"
    );
  }
  return value;
}

export function socialProfileUrl(platform: SocialPlatform, handle: string): string {
  return platform === "instagram" ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`;
}
