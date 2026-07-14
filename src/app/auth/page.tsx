"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Icon, Input, PasswordInput, Screen } from "@/components/ui";
import {
  signUpWithEmail,
  signInWithEmail,
  resetPasswordForEmail,
  translateAuthError,
} from "@/services/auth/authService";
import { getProfile } from "@/services/profile/profileService";
import { getPreferences } from "@/services/preferences/preferencesService";
import { getPostAuthPath } from "@/services/onboarding/onboardingService";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "@/utils/validation";

type Tab = "signup" | "signin";

function EmailIcon() {
  return <Icon name="envelope-email" size={18} />;
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.437 2.15-1.31 3.06-.9.94-1.98 1.48-3.17 1.4-.05-1.1.44-2.15 1.3-3.05.95-.99 2.1-1.55 3.18-1.41zM20.6 17.02c-.55 1.27-.82 1.83-1.53 2.95-1 1.57-2.4 3.52-4.14 3.54-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.1 1-1.75-.02-3.08-1.79-4.08-3.35-2.8-4.32-3.1-9.4-1.37-12.1 1.23-1.9 3.17-3.02 5-3.02 1.87 0 3.05 1.03 4.6 1.03 1.5 0 2.4-1.03 4.6-1.03 1.63 0 3.36.89 4.58 2.42-4.03 2.2-3.37 7.94.49 9.56z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

async function redirectAfterAuth(userId: string, router: ReturnType<typeof useRouter>) {
  const [profile, preferences] = await Promise.all([
    getProfile(userId),
    getPreferences(userId),
  ]);
  router.push(getPostAuthPath(profile, preferences));
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
    if (data.session && data.user) {
      await redirectAfterAuth(data.user.id, router);
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
    const { data, error } = await signInWithEmail(siEmail, siPassword);
    setSiLoading(false);

    if (error) {
      setSiFormError(translateAuthError(error.message));
      return;
    }
    if (data.user) {
      await redirectAfterAuth(data.user.id, router);
    }
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
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      <div className="relative w-full">
        <Image
          src="/images/hero-auth.png"
          alt="קמע triplace עם דרכון ומזוודה, מוקף בתמונות יעדי טיול"
          width={800}
          height={800}
          priority
          className="h-auto w-full"
        />
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="חזרה"
          className="absolute start-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-ink shadow-soft"
        >
          <BackIcon />
        </button>
      </div>

      <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 pt-6 pb-10">
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

        {tab === "signup" && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <Field label="אימייל" error={suErrors.email}>
              <Input
                type="email"
                icon={<EmailIcon />}
                value={suEmail}
                onChange={(e) => setSuEmail(e.target.value)}
                placeholder="כתובת אימייל"
              />
            </Field>
            <Field label="סיסמה" error={suErrors.password}>
              <PasswordInput
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                placeholder="סיסמה"
              />
            </Field>
            <Field label="אימות סיסמה" error={suErrors.confirm}>
              <PasswordInput
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                placeholder="אימות סיסמה"
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
                icon={<EmailIcon />}
                value={siEmail}
                onChange={(e) => setSiEmail(e.target.value)}
                placeholder="כתובת אימייל"
              />
            </Field>
            <Field label="סיסמה" error={siErrors.password}>
              <PasswordInput
                value={siPassword}
                onChange={(e) => setSiPassword(e.target.value)}
                placeholder="סיסמה"
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
                icon={<EmailIcon />}
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                placeholder="כתובת אימייל"
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

        <button
          type="button"
          onClick={() => setSocialMessage("כניסת אורח תהיה זמינה בקרוב")}
          className="text-center text-sm font-semibold text-accent"
        >
          המשך כאורח
        </button>

        <div className="flex items-center gap-3 text-xs text-ink-secondary">
          <div className="h-px flex-1 bg-ink-secondary/20" />
          או המשיכו עם
          <div className="h-px flex-1 bg-ink-secondary/20" />
        </div>

        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => setSocialMessage("ההתחברות עם Google תהיה זמינה בקרוב")}
            aria-label="המשך עם Google"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-secondary/20 bg-bg shadow-soft"
          >
            <GoogleIcon />
          </button>
          <button
            type="button"
            onClick={() => setSocialMessage("ההתחברות עם Apple תהיה זמינה בקרוב")}
            aria-label="המשך עם Apple"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-secondary/20 bg-bg text-ink shadow-soft"
          >
            <AppleIcon />
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
