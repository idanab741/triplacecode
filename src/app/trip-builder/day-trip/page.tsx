"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  ChipGroup,
  Field,
  RadioCardGroup,
  Screen,
  Slider,
  Stepper,
} from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { DAY_TRIP_QUESTIONS } from "@/services/tripBuilder/rules/dayTrip";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

const DEFAULT_ANSWERS: DayTripAnswers = {
  companions: "solo",
  childAgeBands: [],
  timing: "today",
  otherDate: null,
  distanceBand: "1h",
  budgetBand: "300-600",
  interests: [],
  durationBand: "2-4h",
  freeText: "",
};

export default function DayTripQuestionnairePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<DayTripAnswers>(DEFAULT_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const step = DAY_TRIP_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === DAY_TRIP_QUESTIONS.length - 1;

  function updateField<K extends keyof DayTripAnswers>(key: K, value: DayTripAnswers[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleNext() {
    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      return;
    }
    await submit();
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function submit() {
    if (!user) {
      router.push("/auth");
      return;
    }

    setLocationError(null);
    setSubmitting(true);

    try {
      const origin = await getCurrentPosition();
      const response = await fetch("/api/trip-builder/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripType: "day_trip", answers: form, origin }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת הטיול נכשלה");

      router.push(`/trip-builder/day-trip/build?sessionId=${data.session.id}`);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "לא הצלחנו לקבל את המיקום שלך. יש לאשר גישה למיקום כדי להמשיך."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
        <Stepper current={stepIndex + 1} total={DAY_TRIP_QUESTIONS.length} />

        <header className="text-center">
          <h1 className="text-xl font-bold text-ink">{step.title}</h1>
        </header>

        <Card>
          {step.type === "companions" && (
            <div className="flex flex-col gap-4">
              <RadioCardGroup
                options={step.options}
                value={form.companions}
                onChange={(value) => updateField("companions", value as DayTripAnswers["companions"])}
              />
              {form.companions === step.childAgeTriggerValue && (
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">{step.childAgeTitle}</p>
                  <ChipGroup
                    options={step.childAgeOptions}
                    selected={form.childAgeBands}
                    onChange={(values) =>
                      updateField("childAgeBands", values as DayTripAnswers["childAgeBands"])
                    }
                  />
                </div>
              )}
            </div>
          )}

          {step.type === "date" && (
            <div className="flex flex-col gap-4">
              <RadioCardGroup
                options={step.options}
                value={form.timing}
                onChange={(value) => updateField("timing", value as DayTripAnswers["timing"])}
              />
              {form.timing === step.otherDateTriggerValue && (
                <Field label="בחר תאריך">
                  <input
                    type="date"
                    value={form.otherDate ?? ""}
                    onChange={(e) => updateField("otherDate", e.target.value)}
                    className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </Field>
              )}
            </div>
          )}

          {step.type === "slider" && (
            <Slider
              steps={step.steps}
              value={form[step.key as keyof DayTripAnswers] as string}
              onChange={(value) => updateField(step.key as keyof DayTripAnswers, value as never)}
            />
          )}

          {step.type === "multi-emoji" && (
            <ChipGroup
              options={step.options}
              selected={form.interests}
              onChange={(values) => updateField("interests", values)}
            />
          )}

          {step.type === "single" && (
            <RadioCardGroup
              options={step.options}
              value={form[step.key as keyof DayTripAnswers] as string}
              onChange={(value) => updateField(step.key as keyof DayTripAnswers, value as never)}
            />
          )}

          {step.type === "text" && (
            <textarea
              value={form.freeText}
              onChange={(e) => updateField("freeText", e.target.value)}
              placeholder={step.placeholder}
              rows={4}
              className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          )}
        </Card>

        {locationError && <p className="text-center text-sm text-danger">{locationError}</p>}

        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={handleBack} disabled={submitting}>
              חזרה
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={handleNext} disabled={submitting}>
            {isLastStep ? (submitting ? "בונים את הטיול..." : "בואו נתחיל") : "הבא"}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("הדפדפן שלך לא תומך באיתור מיקום"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("יש לאשר גישה למיקום כדי לבנות טיול קרוב אליכם")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}
