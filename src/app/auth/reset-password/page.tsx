"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, PasswordInput, Screen } from "@/components/ui";
import { updatePassword, translateAuthError } from "@/services/auth/authService";
import { MIN_PASSWORD_LENGTH } from "@/utils/validation";

/** Destination for Supabase's password-recovery redirect. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }
    if (password !== confirmation) {
      setMessage("הסיסמאות אינן תואמות.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      setMessage(translateAuthError(error.message));
      return;
    }
    router.replace("/auth?tab=login");
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg">
      <form onSubmit={submit} className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5">
        <div><h1 className="text-2xl font-bold text-ink">איפוס סיסמה</h1><p className="mt-2 text-sm text-ink-secondary">בחרו סיסמה חדשה לחשבון שלכם.</p></div>
        <Field label="סיסמה חדשה"><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>
        <Field label="אימות סיסמה"><PasswordInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></Field>
        {message && <p className="text-sm text-danger">{message}</p>}
        <Button fullWidth type="submit" disabled={saving}>{saving ? "שומרים..." : "שמירת סיסמה"}</Button>
      </form>
    </Screen>
  );
}
