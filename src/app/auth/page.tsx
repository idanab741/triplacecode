"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, Screen } from "@/components/ui";
import {
  signUpWithEmail,
  signInWithEmail,
  resetPasswordForEmail,
  translateAuthError,
} from "@/services/auth/authService";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "@/utils/validation";

type Tab = "signup" | "signin";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "login" ? "signin" : "signup";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [forgotMode, setForgotMode] = useState(false);

  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suErrors, setSuErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [suLoading, setSuLoading] = useState(false);
  const [suMessage, setSuMessage] = useState<string | null>(null);
  const [suFormError, setSuFormError] = useState<string | null>(null);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siErrors, setSiErrors] = useState<{ email?: string; password?: string }>({});
  const [siLoading, setSiLoading] = useState(false);
  const [siFormError, setSiFormError] = useState<string | null>(null);

  const [fpEmail, setFpEmail] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMessage, setFpMessage] = useState<string | null>(null);

  const [socialMessage, setSocialMessage] = useState<string | null>(null);

  function selectTab(next: Tab) {
    setTab(next);
    setForgotMode(false);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    const errors: typeof suErrors = {};
    if (!isValidEmail(suEmail)) errors.email = "כתובת אימייל לא תקינה";
    if (suPassword.length < MIN_PASSWORD_LENGTH)
      errors.password = `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
    if (suConfirm !== suPassword) errors.confirm = "הסיסמאות אינן תואמות";
    setSuErrors(errors);
    setSuFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSuLoading(true);
    const { data, error } = await signUpWithEmail(suEmail, suPassword);
    setSuLoading(false);

    if (error) {
      setSuFormError(translateAuthError(error.message));
      return;
    }
    if (data.session) {
      router.push("/home");
    } else {
      setSuMessage("שלחנו אליך מייל לאימות החשבון. יש לאשר אותו כדי להתחבר.");
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    const errors: typeof siErrors = {};
    if (!isValidEmail(siEmail)) errors.email = "כתובת אימייל לא תקינה";
    if (siPassword.length < MIN_PASSWORD_LENGTH)
      errors.password = `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
    setSiErrors(errors);
    setSiFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSiLoading(true);
    const { error } = await signInWithEmail(siEmail, siPassword);
    setSiLoading(false);

    if (error) {
      setSiFormError(translateAuthError(error.message));
      return;
    }
    router.push("/home");
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(fpEmail)) {
      setFpMessage("כתובת אימייל לא תקינה");
      return;
    }
    setFpLoading(true);
    await resetPasswordForEmail(fpEmail);
    setFpLoading(false);
    setFpMessage("אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.");
  }

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-ink">ברוכים הבאים!</h1>
          <p className="mt-1 text-ink-secondary">ההרפתקה שלכם מתחילה כאן!</p>
        </header>

        <div className="flex rounded-pill bg-bg-secondary p-1">
          <button
            type="button"
            onClick={() => selectTab("signup")}
            className={`flex-1 rounded-pill py-2 text-sm font-semibold transition-colors ${
              tab === "signup"
                ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
                : "text-ink-secondary"
            }`}
          >
            הרשמה
          </button>
          <button
            type="button"
            onClick={() => selectTab("signin")}
            className={`flex-1 rounded-pill py-2 text-sm font-semibold transition-colors ${
              tab === "signin"
                ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
                : "text-ink-secondary"
            }`}
          >
            התחברות
          </button>
        </div>

        <Card>
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <Field label="אימייל" error={suErrors.email}>
                <Input
                  type="email"
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              <Field label="סיסמה" error={suErrors.password}>
                <Input
                  type="password"
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="אימות סיסמה" error={suErrors.confirm}>
                <Input
                  type="password"
                  value={suConfirm}
                  onChange={(e) => setSuConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              {suFormError && <p className="text-sm text-danger">{suFormError}</p>}
              {suMessage && <p className="text-sm text-accent">{suMessage}</p>}
              <Button type="submit" fullWidth disabled={suLoading}>
                {suLoading ? "רושם..." : "הרשמה"}
              </Button>
            </form>
          )}

          {tab === "signin" && !forgotMode && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <Field label="אימייל" error={siErrors.email}>
                <Input
                  type="email"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              <Field label="סיסמה" error={siErrors.password}>
                <Input
                  type="password"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="self-start text-sm text-accent"
              >
                שכחתי סיסמה
              </button>
              {siFormError && <p className="text-sm text-danger">{siFormError}</p>}
              <Button type="submit" fullWidth disabled={siLoading}>
                {siLoading ? "מתחבר..." : "התחברות"}
              </Button>
            </form>
          )}

          {tab === "signin" && forgotMode && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <p className="text-sm text-ink-secondary">
                הזינו את כתובת האימייל שלכם ונשלח קישור לאיפוס סיסמה.
              </p>
              <Field label="אימייל">
                <Input
                  type="email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              {fpMessage && <p className="text-sm text-accent">{fpMessage}</p>}
              <Button type="submit" fullWidth disabled={fpLoading}>
                {fpLoading ? "שולח..." : "שלח קישור לאיפוס"}
              </Button>
              <button
                type="button"
                onClick={() => setForgotMode(false)}
                className="text-sm text-ink-secondary"
              >
                חזרה להתחברות
              </button>
            </form>
          )}
        </Card>

        <Button href="/home" variant="secondary" fullWidth>
          המשך כאורח
        </Button>

        <div className="flex items-center gap-3 text-xs text-ink-secondary">
          <div className="h-px flex-1 bg-ink-secondary/20" />
          או המשיכו עם
          <div className="h-px flex-1 bg-ink-secondary/20" />
        </div>

        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => setSocialMessage("ההתחברות עם Google תהיה זמינה בקרוב")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-secondary/20 bg-bg text-base font-semibold text-ink shadow-soft"
          >
            G
          </button>
          <button
            type="button"
            onClick={() => setSocialMessage("ההתחברות עם Apple תהיה זמינה בקרוב")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-secondary/20 bg-bg text-base font-semibold text-ink shadow-soft"
          >
            A
          </button>
        </div>
        {socialMessage && (
          <p className="text-center text-sm text-ink-secondary">{socialMessage}</p>
        )}
      </div>
    </Screen>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <Screen withBottomNavSpacing={false}>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
