"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatedHeaderBackdrop } from "@/screens/home/AnimatedHeaderBackdrop";
import { HomeHeader } from "@/screens/home/HomeHeader";

interface CollapsibleTopBarProps {
  loading: boolean;
  /** כשמועבר - כפתור הצ'אט מוחלף בכפתור "חזור" (BackButton של האפליקציה).
   *  לעמודים "הבאים" שמשתמשים באותו בר. */
  onBack?: () => void;
  /** התוכן שנעלם בגלילה (שורת החיפוש). בלי children - בר קבוע פשוט. */
  children?: ReactNode;
  /** מרים את הבר מעל שכבת ההסבר (SearchIntroOverlay), כדי שיישאר מוגדר
   *  וחד בזמן שכל שאר העמוד מעומעם. */
  raised?: boolean;
}

const BAR_GRADIENT = "linear-gradient(150deg, #3FCBFD 0%, #0AA9FD 35%, #008EFD 70%, #007CFE 100%)";

/**
 * *** חדש (בקשה מפורשת - "הבר העליון ישאר - רק עם שורת הלוגו, ההתראות והצ'אט
 * גם כשגוללים למטה. שורת החיפוש תיעלם בגלילה, באופן אנימטיבי ודינמי"):
 * הבר התכלת נדבק לראש המסך (sticky). ככל שגוללים, שורת החיפוש מתכווצת,
 * מתעמעמת ונעלמת - **בהתאמה רציפה למרחק הגלילה** (לא מתג כבוי/דולק), עד
 * שנשארת רק שורת הלוגו/התראות/צ'אט.
 *
 * למה לא משנים את גובה הבר בפועל: הוא היה מזיז את כל העמוד שמתחתיו בכל
 * פיקסל גלילה. במקום זה, כל פיקסל שהבר מתכווץ מקבל margin-bottom זהה -
 * הגובה הכולל בתוך העמוד קבוע, וקצה הבר התחתון נע בדיוק יחד עם התוכן
 * שמתחתיו (כמו גלילה רגילה) - עד שהחיפוש נעלם והבר נדבק.
 * מעודכן ישירות על ה-DOM (לא דרך React state) - בלי רינדור בכל פריים.
 *
 * כל הרקע (הגרדיאנט, הצל, האנימציה העדינה של ההילות, פינות מעוגלות) זהה
 * למה שהיה ב-home/page.tsx - עבר לכאן כמו שהוא. בלי overflow-hidden על
 * הבר עצמו, כדי שתפריט ההצעות של החיפוש והבועה של ההתראות יוכלו לצאת.
 */
export function CollapsibleTopBar({ loading, onBack, children, raised = false }: CollapsibleTopBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const collapsible = Boolean(children);

  useEffect(() => {
    if (!collapsible) return;
    const bar = barRef.current;
    const clip = clipRef.current;
    const content = contentRef.current;
    if (!bar || !clip || !content) return;

    let naturalHeight = content.offsetHeight;
    let raf = 0;

    function apply() {
      raf = 0;
      if (!bar || !clip || !naturalHeight) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / naturalHeight));
      if (progress === 0) {
        // מצב מלא: הכל חוזר לטבעי (גם כדי שתפריט ההצעות יוכל לצאת מהבר).
        bar.style.marginBottom = "";
        clip.style.height = "";
        clip.style.overflow = "";
        clip.style.opacity = "";
        clip.style.transform = "";
        clip.style.pointerEvents = "";
        return;
      }
      const collapsed = naturalHeight * progress;
      bar.style.marginBottom = `${collapsed}px`;
      clip.style.height = `${naturalHeight - collapsed}px`;
      clip.style.overflow = "hidden";
      // נעלם מהר יותר מהכיווץ עצמו - מרגיש "נשאב" למעלה ולא נחתך.
      clip.style.opacity = String(Math.max(0, 1 - progress * 1.7));
      clip.style.transform = `translateY(${-10 * progress}px)`;
      clip.style.pointerEvents = progress > 0.5 ? "none" : "";
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(apply);
    }

    function onResize() {
      // מודדים מחדש רק כשהחיפוש במצב מלא (אחרת ה-offsetHeight הנוכחי מכווץ).
      if (window.scrollY === 0 && content) naturalHeight = content.offsetHeight;
      onScroll();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [collapsible]);

  return (
    <div
      ref={barRef}
      data-home-top-bar=""
      className={`sticky top-0 rounded-b-[32px] pb-5 ${raised ? "z-[65]" : "z-30"}`}
      style={{
        background: BAR_GRADIENT,
        boxShadow: "0 12px 30px -14px rgba(0, 124, 254, 0.6)",
      }}
    >
      <AnimatedHeaderBackdrop />
      <HomeHeader loading={loading} onBack={onBack} />

      {collapsible && (
        <div ref={clipRef} style={{ willChange: "height, opacity, transform" }}>
          <div ref={contentRef} className="px-5 pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
