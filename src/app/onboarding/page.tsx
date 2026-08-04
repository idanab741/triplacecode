"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { OnboardingProgress } from "@/screens/onboarding/OnboardingProgress";
import { OnboardingBackdrop } from "@/screens/onboarding/OnboardingBackdrop";
import { Slide1Welcome } from "@/screens/onboarding/slides/Slide1Welcome";
import { Slide2Profile } from "@/screens/onboarding/slides/Slide2Profile";

/** מפתח localStorage שמסמן שהמשתמש כבר ראה את ה-Onboarding, כדי שלא יוצג שוב.
 *  המסך הזה מופיע פעם אחת, מיד אחרי שמשתמש מתחבר/נרשם ומגיע לעמוד הבית
 *  לראשונה (ראו את הבדיקה ב-src/app/home/page.tsx) - לכן אין כאן שום
 *  לוגיקת "המשך כאורח" - המשתמש כבר מחובר בשלב הזה. */
export const ONBOARDING_STORAGE_KEY = "triplace_onboarding_completed";

const SLIDES = [Slide1Welcome, Slide2Profile];

/** תמונת הרקע (המטושטשת) של כל מסך - צילום ה-hero האמיתי של אותו פיצ'ר
 *  באפליקציה, כדי שהרקע מאחורי כל מסך Onboarding יהיה תמיד "חלון" לתוכן
 *  האמיתי, לא רקע לבן גנרי. הרקע ממוקם ברמת הדף (לא בתוך כל שקופית), כדי
 *  שהוא יכסה את המסך כולו - כולל פס ההתקדמות והכפתור התחתון. */
const SLIDE_BACKDROPS = [
  "/images/home-hero.png",
  "/images/hero-profile-setup.png",
];

const SWIPE_THRESHOLD_PX = 55;
/** משיכה מעבר לקצה הראשון/אחרון מקבלת התנגדות (גומי), כמו בכל מנגנון סוויפ אחר באפליקציה. */
const EDGE_RESISTANCE = 0.35;

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** מסך ה-Onboarding המלא - 5 מסכים, כל אחד ממחיש יכולת אחת קיימת באפליקציה.
 *  מוצג פעם אחת בלבד למשתמש חדש, אחרי כניסה, לפני עמוד הבית. */
export default function OnboardingPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);

  const total = SLIDES.length;
  const isLast = step === total - 1;

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // דגלים/מיקומים של מחוות הסוויפ - לא state בכוונה, כדי לא לגרום ל-re-render
  // בכל פיקסל תזוזה (בדיוק כמו הלוגיקה הקיימת ב-SortableStopCard.tsx).
  const dragState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastDeltaX: 0,
    direction: null as "horizontal" | "vertical" | null,
    pointerId: null as number | null,
  });

  async function markSeen() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // localStorage לא זמין (מצב פרטי וכו') - לא קריטי, לא חוסם את הזרימה
    }
    // כותבים ל-DB וממתינים לזה *לפני* שממשיכים - קריטי: אם לא נחכה,
    // המשתמש ינווט ל-/home בזמן שה-profile הישן (מלפני העדכון) עדיין
    // יושב ב-context, ועמוד הבית יראה intro_completed_at ריק ויקפיץ
    // בחזרה ל-/onboarding מיד. refreshProfile() בסוף מוודא שה-context
    // מתעדכן עם הנתון החדש לפני שהניווט קורה.
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // מציגים את זה בגלוי - אחרת המשתמש רק "ייתקע" בלולאה בחזרה
        // ל-Onboarding בלי שום הסבר למה.
        alert(`שגיאה בסימון הסיור כהושלם:\n\n${data?.error ?? res.status}\n\nהמשך לאפליקציה ינסה בכל זאת, אבל ייתכן שתחזור לכאן שוב.`);
      }
    } catch (e) {
      alert(`שגיאת רשת בסימון הסיור כהושלם: ${e instanceof Error ? e.message : String(e)}`);
    }
    await refreshProfile();
  }

  async function goHome() {
    await markSeen();
    router.push("/home");
  }

  function setTrackTransform(percent: number, animated: boolean) {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animated ? "transform 380ms cubic-bezier(0.22,1,0.36,1)" : "none";
    track.style.transform = `translateX(${percent}%)`;
  }

  function renderTrack(nextStep: number) {
    // הערה: הכיוון פה (חיובי) נכון לצורה שבה track מקונן בתוך stage כשניהם
    // יורשים dir="rtl" באופן טבעי (בלי לאלץ direction:ltr על אף אחד מהם) -
    // זה שונה ממימוש עצמאי עם position:absolute, שם הסימן היה הפוך.
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

  // --- סוויפ אופקי: שמאלה = הבא, ימינה = אחורה (כמו קרוסלת RTL רגילה) ---
  // תופס pointer capture כבר ב-pointerdown (ולא רק אחרי זיהוי כיוון), כדי
  // שגרירה על תמונה בתוך המסך לא "תיחטף" ע"י גרירת-תמונה מובנית של הדפדפן.
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
    // dx הפוך בכוונה: המשתמשים דיווחו שההחלקה עבדה הפוך (שמאלה הזיז ימינה
    // ולהפך) - כך שההגדרה הנכונה בפועל היא ההפך ממה שהאינטואיציה הגיאומטרית
    // הראשונית הייתה מציעה.
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
        <Button fullWidth onClick={handleNext}>
          {isLast ? "המשך לאפליקציה" : "הבא"}
        </Button>
      </div>
      </div>
    </div>
  );
}
