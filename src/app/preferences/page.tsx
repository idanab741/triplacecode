"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Chip, Screen, Switch } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { isProfileComplete } from "@/services/profile/profileService";
import {
  isPreferencesComplete,
  savePreferences,
  completePreferences,
} from "@/services/preferences/preferencesService";
import {
  STEPS,
  EMPTY_PREFERENCES_STATE,
  type PreferencesFormState,
  type MultiFieldKey,
} from "./steps";

function PreferencesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const {
    user,
    loading,
    profile,
    profileLoading,
    preferences,
    preferencesLoading,
    refreshPreferences,
  } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<PreferencesFormState>(EMPTY_PREFERENCES_STATE);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!preferencesLoading && !initialized) {
    setInitialized(true);
    setForm({
      culinary_styles: preferences?.culinary_styles ?? [],
      dietary_restrictions: preferences?.dietary_restrictions ?? [],
      kosher: preferences?.kosher ?? false,
      accessibility: preferences?.accessibility ?? false,
      transportation: preferences?.transportation ?? [],
      interests: preferences?.interests ?? [],
      accommodation_types: preferences?.accommodation_types ?? [],
      vacation_preferences: preferences?.vacation_preferences ?? [],
    });
  }

  useEffect(() => {
    if (!loading && !profileLoading && user && !isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  useEffect(() => {
    if (!preferencesLoading && isPreferencesComplete(preferences) && !returnTo) {
      router.replace("/home");
    }
  }, [preferencesLoading, preferences, returnTo, router]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function toggleChip(key: MultiFieldKey, value: string) {
    setForm((f) => {
      const list = f[key];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...f, [key]: next };
    });
  }

  async function advance(updatedForm: PreferencesFormState, markComplete: boolean) {
    if (!user) return;
    setForm(updatedForm);
    setSaving(true);

    if (markComplete) {
      await completePreferences(user.id, updatedForm);
    } else {
      await savePreferences(user.id, { [step.key]: updatedForm[step.key] });
    }

    setSaving(false);

    if (markComplete) {
      await refreshPreferences();
      router.push(returnTo || "/home");
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleNext() {
    advance(form, isLastStep);
  }

  function handleSkip() {
    const cleared: PreferencesFormState = {
      ...form,
      [step.key]: step.type === "multi" ? [] : false,
    };
    advance(cleared, isLastStep);
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (loading || profileLoading || preferencesLoading || !initialized) {
    return (
      <Screen withBottomNavSpacing={false}>
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-secondary">
          <div
            className="h-full rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] transition-all"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <header className="text-center">
          <h1 className="text-xl font-bold text-ink">{step.title}</h1>
          <p className="mt-1 text-xs text-ink-secondary">
            שלב {stepIndex + 1} מתוך {STEPS.length}
          </p>
        </header>

        <Card>
          {step.type === "multi" && (
            <div className="flex flex-wrap gap-2">
              {step.options.map((option) => (
                <Chip
                  key={option.value}
                  selected={form[step.key].includes(option.value)}
                  onClick={() => toggleChip(step.key, option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          )}

          {step.type === "toggle" && (
            <Switch
              checked={form[step.key]}
              onChange={(checked) => setForm((f) => ({ ...f, [step.key]: checked }))}
              label={step.title}
            />
          )}
        </Card>

        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={handleBack} disabled={saving}>
              חזרה
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={handleNext} disabled={saving}>
            {isLastStep ? "סיום" : "הבא"}
          </Button>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="text-center text-sm text-ink-secondary"
        >
          דלג
        </button>
      </div>
    </Screen>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense
      fallback={
        <Screen withBottomNavSpacing={false}>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <PreferencesPageContent />
    </Suspense>
  );
}
