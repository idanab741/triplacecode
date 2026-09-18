"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingProgress } from "@/screens/onboarding/OnboardingProgress";
import { OnboardingBackdrop } from "@/screens/onboarding/OnboardingBackdrop";
import { Slide1Welcome } from "@/screens/onboarding/slides/Slide1Welcome";
import { Slide2Profile } from "@/screens/onboarding/slides/Slide2Profile";
import { Slide3TripMatch } from "@/screens/onboarding/slides/Slide3TripMatch";
import { Slide4Ai } from "@/screens/onboarding/slides/Slide4Ai";
import { Slide5Route } from "@/screens/onboarding/slides/Slide5Route";

export const ONBOARDING_STORAGE_KEY = "triplace_onboarding_completed";

const SLIDES = [Slide1Welcome, Slide2Profile, Slide3TripMatch, Slide4Ai, Slide5Route];

const SLIDE_BACKDROPS = [
  "/images/home-hero.png",
  "/images/hero-profile-setup.png",
  "/images/destination/newyork.png",
  "/images/tripy.png",
  "/images/hero-day-trip-result.png",
];

const SWIPE_THRESHOLD_PX = 55;
const EDGE_RESISTANCE = 0.35;

function BackArrow() {
  return (
    <svg width="14" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);

  const total = SLIDES.length;
  const isLast = step === total - 1;

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastDeltaX: 0,
    direction: null as "horizontal" | "vertical" | null,
    pointerId: null as number | null,
  });

  async function markSeen(): Promise<boolean> {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // localStorage לא זמין - לא קריטי
    }
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature: "main" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`שגיאה בסימון הסיור כהושלם:\n\n${data?.error ?? res.status}\n\nהמשך לאפליקציה ינסה בכל זאת, אבל ייתכן שתחזור לכאן שוב.`);
        return false;
      }
    } catch (e) {
      alert(`שגיאת רשת בסימון הסיור כהושלם: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
    await refreshProfile();
    return true;
  }

  async function goHome() {
    if (await markSeen()) router.push("/home");
  }

  function setTrackTransform(percent: number, animated: boolean) {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animated ? "transform 380ms cubic-bezier(0.22,1,0.36,1)" : "none";
    track.style.transform = `translateX(${percent}%)`;
  }

  function renderTrack(nextStep: number) {
    setTrackTransform(nextStep * (100 / total), true);
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setStep(clamped);
    renderTrack(clamped);
  }

  function handleNext() {
    if (isLast) {
      goHome();
      return;
    }
    goTo(step + 1);
  }

  function handleBack() {
    if (step === 0) return;
    goTo(step - 1);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      lastDeltaX: 0,
      direction: null,
      pointerId: e.pointerId,
    };
    stageRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag.active) return;
    const dx = -(e.clientX - drag.startX);
    const dy = e.clientY - drag.startY;

    if (drag.direction === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (drag.direction !== "horizontal") return;

    e.preventDefault();
    drag.lastDeltaX = dx;
    const atStart = step === 0 && dx > 0;
    const atEnd = step === total - 1 && dx < 0;
    const resisted = atStart || atEnd ? dx * EDGE_RESISTANCE : dx;

    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 1;
    const dragPercent = (-resisted / stageWidth) * (100 / total);
    setTrackTransform(step * (100 / total) + dragPercent, false);
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag.active) return;
    drag.active = false;
    if (drag.pointerId != null) {
      try {
        stageRef.current?.releasePointerCapture(drag.pointerId);
      } catch {
        // ה-pointer כבר לא נתפס - לא קריטי
      }
    }

    if (drag.direction === "horizontal") {
      if (drag.lastDeltaX <= -SWIPE_THRESHOLD_PX) {
        handleNext();
        return;
      }
      if (drag.lastDeltaX >= SWIPE_THRESHOLD_PX && step > 0) {
        goTo(step - 1);
        return;
      }
    }
    renderTrack(step);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg">
      {SLIDE_BACKDROPS.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{ opacity: i === step ? 1 : 0 }}
          aria-hidden={i !== step}
        >
          <OnboardingBackdrop src={src} />
        </div>
      ))}

      <div className="relative z-10 flex flex-1 flex-col">
      <div className="px-6 pt-6">
        <OnboardingProgress current={step} total={total} />
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            aria-label="חזרה"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary transition disabled:opacity-0"
            disabled={step === 0}
          >
            <BackArrow />
          </button>
          {!isLast && (
            <button type="button" onClick={goHome} className="text-sm font-medium text-ink-secondary">
              דלג
            </button>
          )}
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex flex-1 select-none overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={trackRef}
          className="flex shrink-0"
          style={{ width: `${SLIDES.length * 100}%`, transform: "translateX(0%)" }}
        >
          {SLIDES.map((Slide, i) => (
            <div key={i} className="flex shrink-0 flex-col" style={{ width: `${100 / SLIDES.length}%` }}>
              <Slide />
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-4">
        <p className="mb-2.5 text-center text-xs text-ink-secondary/70">החליקו ימינה או שמאלה, או השתמשו בכפתורים</p>
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-pill py-2 text-sm font-semibold text-white shadow-md"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {isLast ? "המשך לאפליקציה" : "הבא"}
        </button>
      </div>
      </div>
    </div>
  );
}