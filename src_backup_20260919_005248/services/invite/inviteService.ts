import { createClient } from "@/services/supabase/client";

/**
 * שירות לינק ההזמנה האישי (ר' migration 0061 - profiles.invite_code +
 * redeem_invite()). הלוגיקה כאן מטרתה כפולה:
 *
 * 1. בניית הלינק האישי האמיתי של המשתמש המחובר (buildInviteUrl) - לעולם
 *    לא URL כללי/דמה.
 * 2. שמירת קוד הזמנה שהתקבל דרך /join/<code> עד שהמוזמן משלים הרשמה/
 *    התחברות, ואז "פדיון" הקוד (redeemInviteCode) כדי לשמור את הקשר בין
 *    המזמין למוזמן דרך redeem_invite() ב-DB.
 */

const PENDING_REF_STORAGE_KEY = "triplace_pending_invite_code";

function resolveOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://triplace.app";
}

/** בונה את לינק ההזמנה האישי והאמיתי של המשתמש מתוך קוד ההזמנה שלו. */
export function buildInviteUrl(inviteCode: string): string {
  return `${resolveOrigin()}/join/${inviteCode}`;
}

/** שומר בדפדפן קוד הזמנה שהתקבל, עד שההרשמה/התחברות תושלם. */
export function storePendingInviteCode(code: string) {
  if (typeof window === "undefined" || !code) return;
  try {
    window.localStorage.setItem(PENDING_REF_STORAGE_KEY, code);
  } catch {
    // localStorage לא זמין (למשל מצב פרטי חוסם) - לא קריטי, פשוט לא נשמור
  }
}

/** קורא קוד הזמנה ממתין בלי למחוק אותו (לשימוש בבדיקות תצוגה בלבד). */
export function peekPendingInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_REF_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** קורא ומוחק את קוד ההזמנה הממתין - נקרא פעם אחת, אחרי ניסיון פדיון. */
export function consumePendingInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = window.localStorage.getItem(PENDING_REF_STORAGE_KEY);
    if (code) window.localStorage.removeItem(PENDING_REF_STORAGE_KEY);
    return code;
  } catch {
    return null;
  }
}

/**
 * פודה קוד הזמנה עבור המשתמש המחובר כרגע - קוראת ל-redeem_invite() ב-DB
 * (security definer, פועלת מול auth.uid() של המשתמש הנוכחי). מחזירה
 * true רק אם הקשר בין המזמין למוזמן נקבע כרגע בפועל.
 */
export async function redeemInviteCode(code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) {
    console.error("[inviteService] redeemInviteCode failed:", error.message);
    return false;
  }
  return Boolean(data);
}
