"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatedHeaderBackdrop } from "@/screens/home/AnimatedHeaderBackdrop";
import { HomeHeader } from "@/screens/home/HomeHeader";

interface CollapsibleTopBarProps {
  loading?: boolean;
  /** *** שורת הכותרת העליונה (ברירת מחדל: HomeHeader של triplace). place's מעביר
   *  את PlacesHeaderRow - כך שני הבארים נבנים מאותו רכיב, באותו מיקום ובאותן מידות. */
  headerRow?: ReactNode;
  /** רקע הבר (ברירת מחדל: הגרדיאנט התכלת של הבית). */
  gradient?: string;
  shadow?: string;
  /** גוון ההילות המונפשות. */
  tone?: "blue" | "purple";
  /** כשמועבר - כפתור הצ'אט מוחלף בכפתור "חזור" (BackButton של האפליקציה).
   *  לעמודים "הבאים" שמשתמשים באותו בר. */
  onBack?: () => void;
  /** עמוד הפרופיל שלי: תפריט שלוש-הפסים (קישור) במקום הפעמון. */
  menuHref?: string;
  /** התוכן שנעלם בגלילה (שורת החיפוש). בלי children - בר קבוע פשוט. */
  children?: ReactNode;
  /** מרים את הבר מעל שכבת ההסבר (SearchIntroOverlay), כדי שיישאר מוגדר
   *  וחד בזמן שכל שאר העמוד מעומעם. */
  raised?: boolean;
}

const BAR_GRADIENT = "linear-gradient(150deg, #3FCBFD 0%, #0AA9FD 35%, #008EFD 70%, #007CFE 100%)";
const BAR_SHADOW = "0 12px 30px -14px rgba(0, 124, 254, 0.6)";

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
export function CollapsibleTopBar({
  loading = false,
  headerRow,
  gradient = BAR_GRADIENT,
  shadow = BAR_SHADOW,
  tone = "blue",
  onBack,
  menuHref,
  children,
  raised = false,
}: CollapsibleTopBarProps) {
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
        clip.style.pointerEvents = "";
        if (content) content.style.transform = "";
        return;
      }
      const collapsed = naturalHeight * progress;
      bar.style.marginBottom = `${collapsed}px`;
      clip.style.height = `${naturalHeight - collapsed}px`;
      clip.style.overflow = "hidden";
      clip.style.pointerEvents = progress > 0.5 ? "none" : "";
      // *** תיקון (בקשה מפורשת - "בעיה בהחלקה כשגוללים חזרה למעלה, פער צבע, צל
      // מיותר"): קודם השורה התעמעמה (opacity) ועלתה קצת - ובזמן הגלילה חזרה היא
      // הייתה שקופה למחצה מעל הסגול (גוון עכור), והצל שלה נחתך בקצה התחתון.
      // עכשיו היא תמיד אטומה לגמרי ופשוט "גולשת" למעלה, מתחת לשורת הכותרת (התוכן
      // עולה בדיוק במרחק שהבר התכווץ, והקצה התחתון שלה צמוד לקצה התחתון של הבר) -
      // כמו תוכן שגולל מתחת לבר נדבק. transform בלבד - חלק וללא עכירות.
      if (content) content.style.transform = `translate3d(0, ${-collapsed}px, 0)`;
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
        background: gradient,
        boxShadow: shadow,
      }}
    >
      <AnimatedHeaderBackdrop tone={tone} />
      {headerRow ?? <HomeHeader loading={loading} onBack={onBack} menuHref={menuHref} />}

      {collapsible && (
        <div ref={clipRef}>
          <div ref={contentRef} data-collapsible-content="" className="px-5 pt-4" style={{ willChange: "transform" }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
