"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Field, Input, Screen, Select } from "@/components/ui";
import { AvatarUploader } from "@/components/AvatarUploader";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, isProfileComplete } from "@/services/profile/profileService";
import { isReasonableBirthDate, MAX_AGE, MIN_AGE } from "@/utils/validation";
import { COUNTRIES } from "@/constants/countries";

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, loading, profile, profileLoading, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("ישראל");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; city?: string; birthDate?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoading && isProfileComplete(profile)) {
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
      setFormError("שמירת הפרופיל נכשלה, נסו שוב");
      return;
    }

    await refreshProfile();
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
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
        {user && <AvatarUploader userId={user.id} initialUrl={profile?.avatar_url} />}

        <header className="text-center">
          <h1 className="text-2xl font-bold text-ink">בניית פרופיל</h1>
          <p className="mt-1 text-ink-secondary">עוד רגע מתחילים לטייל!</p>
          <div className="mt-3 flex justify-center gap-2">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-2 w-2 rounded-full ${dot === 1 ? "bg-[var(--color-primary-start)]" : "bg-ink-secondary/25"}`}
              />
            ))}
          </div>
        </header>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="שם מלא" error={errors.fullName}>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                }
              />
            </Field>

            <Field label="כתובת / עיר מגורים" error={errors.city}>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="תל אביב"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s7-6.5 7-12A7 7 0 0 0 5 10c0 5.5 7 12 7 12Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                }
              />
            </Field>

            <Field label="תאריך לידה" error={errors.birthDate}>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                }
              />
            </Field>

            <Field label="מדינה">
              <Select
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
                placeholder="בחרו מדינה"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
                  </svg>
                }
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

            <Button type="submit" variant={isValid ? "primary" : "secondary"} disabled={!isValid || submitting} fullWidth>
              {submitting ? "שומר..." : "ממשיכים!"}
            </Button>
          </form>
        </Card>
      </div>
    </Screen>
  );
}
