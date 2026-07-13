import { createClient } from "@/services/supabase/client";

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
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
