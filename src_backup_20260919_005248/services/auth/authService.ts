import { createClient } from "@/services/supabase/client";

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

export async function verifySignupOtp(email: string, token: string) {
  const supabase = createClient();
  return supabase.auth.verifyOtp({ email, token, type: "signup" });
}

export async function resendSignupOtp(email: string) {
  const supabase = createClient();
  return supabase.auth.resend({ type: "signup", email });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInAsGuest() {
  const supabase = createClient();
  return supabase.auth.signInAnonymously();
}

/** inviteCode, אם קיים, מצטרף לכתובת ה-callback כדי לשרוד את סבב ה-OAuth
 *  (ר' /auth/callback/route.ts, שקורא אותו ומריץ redeem_invite). */
export async function signInWithOAuth(provider: "google" | "apple", inviteCode?: string | null) {
  const supabase = createClient();
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  if (inviteCode) callbackUrl.searchParams.set("ref", inviteCode);
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl.toString() },
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

export async function updatePassword(password: string) {
  const supabase = createClient();
  return supabase.auth.updateUser({ password });
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

export function translateAuthError(message: string): string {
  return KNOWN_ERRORS[message] ?? message;
}
