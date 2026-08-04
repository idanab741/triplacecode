"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { FeatureKey } from "@/hooks/useFeatureOnboardingGuard";

/** Reuses existing onboarding slides; only their completion timing is controlled here. */
export function FeatureOnboardingScreen({
  feature,
  destination,
  Slide,
  Slides,
}: {
  feature: FeatureKey;
  destination: string;
  Slide?: ComponentType;
  Slides?: ComponentType[];
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = Slides ?? (Slide ? [Slide] : []);
  const CurrentSlide = slides[slideIndex];
  const isLastSlide = slideIndex === slides.length - 1;

  async function handleContinue() {
    if (loading) return;
    if (!isLastSlide) {
      setSlideIndex((current) => current + 1);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? String(response.status));
      await refreshProfile();
      router.replace(destination);
    } catch (error) {
      alert(`שגיאה בשמירת ההתקדמות: ${error instanceof Error ? error.message : String(error)}`);
      setLoading(false);
    }
  }

  if (!CurrentSlide) return null;
  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <div className="relative flex flex-1 flex-col"><CurrentSlide /></div>
      <div className="px-6 pb-8 pt-4">
        <Button fullWidth onClick={handleContinue} disabled={loading}>{loading ? "רגע..." : "המשך"}</Button>
      </div>
    </div>
  );
}
