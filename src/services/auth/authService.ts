import { createClient } from "@/services/supabase/client";

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * כניסה כ"אורח" - session אנונימי אמיתי דרך Supabase (לא רק דילוג על
 * התחברות בצד הלקוח). זה נותן user.id אמיתי (עם user.is_anonymous=true),
 * כך שכל שאר האפליקציה שכבר בודקת isGuest (כמו בעמוד הבית) עובדת נכון,
 * ואפשר גם "לשדרג" מאוחר יותר לחשבון קבוע (supabase.auth.updateUser) בלי
 * לאבד את מה שהמשתמש כבר עשה כאורח.
 */
export async function signInAsGuest() {
  const supabase = createClient();
  return supabase.auth.signInAnonymously();
}

/**
 * התחברות עם ספק חיצוני (Google/Apple). **חשוב**: זה דורש גם הגדרה בצד
 * Supabase Dashboard (Authentication -> Providers -> להפעיל את הספק
 * ולהזין Client ID/Secret) - בלי זה, הקריאה הזו תיכשל גם אם הקוד תקין
 * לגמרי, כי Supabase פשוט לא יודע להתחבר לספק שלא הוגדר אצלו.
 */
export async function signInWithOAuth(provider: "google" | "apple") {
  const supabase = createClient();
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}

export async function resetPasswordForEmail(email: string) {
  const supabase = createClient();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
}

export async function getSession() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

const KNOWN_ERRORS: Record<string, string> = {
  "Invalid login credentials": "אימייל או סיסמה שגויים",
  "User already registered": "כבר קיים חשבון עם כתובת האימייל הזו",
  "Email not confirmed": "יש לאשר את כתובת האימייל לפני ההתחברות",
};

/** ממפה הודעות שגיאה מ-Supabase להודעה ברורה בעברית. */
export function translateAuthError(message: string): string {
  return KNOWN_ERRORS[message] ?? message;
}
