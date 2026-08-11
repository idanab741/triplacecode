"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Checkbox, Field, Icon, Input, Screen, Select } from "@/components/ui";
import { AvatarUploader } from "@/components/AvatarUploader";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, isMainOnboardingComplete, isProfileComplete, getProfile } from "@/services/profile/profileService";
import { isReasonableBirthDate, MAX_AGE, MIN_AGE } from "@/utils/validation";
import { COUNTRIES } from "@/constants/countries";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => String(CURRENT_YEAR - MIN_AGE - i));
const BIRTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, loading, profile, profileLoading, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [country, setCountry] = useState("ישראל");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; city?: string; birthDate?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const manualNavigationRef = useRef(false);

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      setBirthDate(`${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`);
    } else {
      setBirthDate("");
    }
  }, [birthDay, birthMonth, birthYear]);

  useEffect(() => {
    if (manualNavigationRef.current) return;
    if (!profileLoading && isProfileComplete(profile)) {
      if (!isMainOnboardingComplete(profile)) {
        router.replace("/onboarding");
        return;
      }
      router.replace("/home");
    }
  }, [profileLoading, profile, router]);

  const isValid =
    fullName.trim().length > 1 &&
    city.trim().length > 1 &&
    birthDate.length > 0 &&
    country.length > 0 &&
    agreed;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "יש להזין שם מלא";
    if (city.trim().length < 2) nextErrors.city = "יש להזין עיר מגורים";
    if (!birthDate) {
      nextErrors.birthDate = "יש לבחור תאריך לידה";
    } else if (!isReasonableBirthDate(birthDate)) {
      nextErrors.birthDate = `הגיל חייב להיות בין ${MIN_AGE} ל-${MAX_AGE}`;
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0 || !agreed || !user) return;

    setSubmitting(true);
    const { error } = await updateProfile(user.id, {
      full_name: fullName.trim(),
      city: city.trim(),
      birth_date: birthDate,
      country,
    });
    setSubmitting(false);

    if (error) {
      setFormError(`שמירת הפרופיל נכשלה: ${error.message}`);
      return;
    }

    manualNavigationRef.current = true;
    await refreshProfile();

    if (user) {
      const freshProfile = await getProfile(user.id);
      if (!isMainOnboardingComplete(freshProfile)) {
        router.push("/onboarding");
        return;
      }
    }

    router.push("/home");
  }

  if (loading || profileLoading) {
    return (
      <Screen withBottomNavSpacing={false}>
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      <div className="relative w-full">
        <Image
          src="/images/hero-profile-setup.png"
          alt="קמע triplace מברך לשלום"
          width={800}
          height={800}
          priority
          className="h-auto w-full"
        />
          <div className="absolute end-4 top-4">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="חזרה"
              className="flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="back-chevron" size={18} />
            </button>
          </div>
        <div
          className="absolute aspect-square -translate-x-1/2 -translate-y-1/2"
          style={{ left: "49.73%", top: "69.28%", width: "42%" }}
        >
          {user && (
            <AvatarUploader
              userId={user.id}
              initialUrl={profile?.avatar_url}
              fluid
              bordered={false}
            />
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 pb-4 pt-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-ink">בניית פרופיל</h1>
          <p className="mt-1 text-ink-secondary">עוד רגע מתחילים לטייל!</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="שם מלא" error={errors.fullName}>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ישראל ישראלי"
              icon={<Icon name="user-person-silhouette" size={18} />}
            />
          </Field>

          <Field label="כתובת / עיר מגורים" error={errors.city}>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="תל אביב"
              icon={<Icon name="location-pin" size={18} />}
            />
          </Field>

          <Field label="תאריך לידה" error={errors.birthDate}>
            <div className="flex gap-2">
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg px-3 py-3 text-sm text-ink"
              >
                <option value="">יום</option>
                {BIRTH_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg px-3 py-3 text-sm text-ink"
              >
                <option value="">חודש</option>
                {HEBREW_MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg px-3 py-3 text-sm text-ink"
              >
                <option value="">שנה</option>
                {BIRTH_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="מדינה">
            <Select
              value={country}
              onChange={setCountry}
              options={COUNTRIES}
              placeholder="בחרו מדינה"
              icon={<Icon name="globe" size={18} />}
            />
          </Field>

          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label={
              <>
                אני מאשר/ת את{" "}
                <a href="/terms" className="text-accent" target="_blank" rel="noopener noreferrer">
                  התקנון
                </a>
              </>
            }
          />

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <Button type="submit" variant={isValid ? "primary" : "secondary"} disabled={!isValid || submitting} fullWidth className="!py-2 !text-sm !font-semibold">
            {submitting ? "שומר..." : "ממשיכים!"}
          </Button>
        </form>
      </div>
    </Screen>
  );
}
