"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Checkbox, Field, Icon, Input, Screen, Select } from "@/components/ui";
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
      setFormError(`שמירת הפרופיל נכשלה: ${error.message}`);
      return;
    }

    await refreshProfile();
    router.push("/preferences");
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
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="חזרה"
          className="absolute start-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-ink shadow-soft"
        >
          <Icon name="back-chevron" size={18} />
        </button>
        <div className="absolute inset-x-0 -bottom-16 flex justify-center">
          {user && (
            <AvatarUploader userId={user.id} initialUrl={profile?.avatar_url} size={168} />
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 pb-10 pt-20">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-ink">בניית פרופיל</h1>
          <p className="mt-1 text-ink-secondary">עוד רגע מתחילים לטייל!</p>
          <div className="mt-3 flex justify-center gap-2">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-2 rounded-pill transition-all ${
                  dot === 2 ? "w-6 bg-[var(--color-primary-start)]" : "w-2 bg-ink-secondary/25"
                }`}
              />
            ))}
          </div>
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
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              icon={<Icon name="calendar" size={18} />}
            />
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

          <Button type="submit" variant={isValid ? "primary" : "secondary"} disabled={!isValid || submitting} fullWidth>
            {submitting ? "שומר..." : "ממשיכים!"}
          </Button>
        </form>
      </div>
    </Screen>
  );
}
