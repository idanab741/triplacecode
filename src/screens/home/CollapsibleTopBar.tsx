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
  /** *** "transparent" (ברירת מחדל) - הבר החדש: שקוף, לוגו צבעוני.
   *  "colored" - הבר הצבעוני הקודם (gradient + פינות מעוגלות + הילות),
   *  לעמוד הבית ול-place's (בקשה מפורשת - "places על רקע כחול"). */
  variant?: "transparent" | "colored";
  /** התוכן שנעלם בגלילה (שורת החיפוש). בלי children - בר קבוע פשוט. */
  children?: ReactNode;
  /** מרים את הבר מעל שכבת ההסבר (SearchIntroOverlay), כדי שיישאר מוגדר
   *  וחד בזמן שכל שאר העמוד מעומעם. */
  raised?: boolean;
  /** פתיחה חד-פעמית של שורת החיפוש מתוך הסבר "צור טיול". */
  forceReveal?: boolean;
}

const BAR_GRADIENT = "linear-gradient(150deg, #3FCBFD 0%, #0AA9FD 35%, #008EFD 70%, #007CFE 100%)";
const BAR_SHADOW = "0 12px 30px -14px rgba(0, 124, 254, 0.6)";

/**
 * *** שונה מהיסוד (בקשה מפורשת - "שורת החיפוש: מוסתרת כברירת מחדל - גם
 * ברגע הראשון; מושכים כלפי מטה בראש הדף ממש (איפה שפעם היה 'משוך
 * לרענון') -> מופיעה מיד במלואה, באופן אנימטיבי; נשארת גלויה עד שמתחילים
 * לגלול/להחליק כלפי מעלה אל תוך הכרטיסים - אז נסגרת שוב"):
 *
 * שורת החיפוש **מוסתרת כברירת מחדל** - גם ברגע הראשון של טעינת העמוד,
 * לא רק אחרי גלילה. המחווה שחושפת אותה היא מחווה של *משיכה* (touch drag)
 * כלפי מטה, ורק כשעושים אותה ממש בראש הדף (scrollY<=0, איפה שבעבר
 * "משוך לרענון" היה קורה - ר' overscroll-behavior-y:none ב-globals.css
 * שכיבה את הרענון הזה) - לא גלילה רגילה של תוכן. ברגע שנרשמת משיכה כזו
 * (אפילו כמה פיקסלים) השורה מופיעה מיד במלואה (בלי מעבר הדרגתי/פרופורציונלי
 * למרחק המשיכה - "מיד במלואה"). היא נשארת גלויה עד שמתחילה גלילה אמיתית
 * של הדף (scrollY זז משמעותית מ-0, כלומר המשתמש בפועל גולל/מחליק כלפי
 * מעלה אל תוך הכרטיסים) - אז היא נסגרת שוב, וחוזרים למצב "מוסתר כברירת
 * מחדל".
 *
 * למה touch events ולא scroll: כש-scrollY כבר 0 ואי אפשר לגלול עוד למעלה,
 * משיכה למטה לא מייצרת אירוע scroll בכלל (במיוחד לא עם overscroll-behavior
 * כבוי) - הדרך היחידה לזהות את המחווה עצמה (לא רק את התוצאה שלה בעמוד)
 * היא להאזין ישירות ל-touchstart/touchmove.
 *
 * ההסתרה/חשיפה עצמן: accordion בינארי פשוט על ה-clip (height: 0px/auto,
 * transition קלה) - *לא* טריק margin-bottom+transform מפצה: טריק כזה
 * מניח שההתכווצות קורית *רק* תוך כדי גלילה בפועל (אז ה-margin המתווסף
 * "נבלע" ע"י אותה כמות גלילה בדיוק) - אבל כאן ההסתרה יכולה לקרות בלי שום
 * גלילה (מיד בטעינה), אז margin קבוע כזה היה נשאר רווח ריק אמיתי במקום.
 * מוסתר = פשוט קטן יותר במקום (בלי טריקים), עם transition קלה על הגובה
 * לחלקות בסגירה (הפתיחה עצמה כבר מיידית מטבעה - "מיד במלואה").
 * מעודכן ישירות על ה-DOM (לא דרך React state) - בלי רינדור בכל פריים.
 *
 * כל הרקע (הגרדיאנט, הצל, האנימציה העדינה של ההילות, פינות מעוגלות) זהה
 * למה שהיה ב-home/page.tsx - עבר לכאן כמו שהוא. בלי overflow-hidden על
 * הבר עצמו, כדי שתפריט ההצעות של החיפוש והבועה של ההתראות יוכלו לצאת.
 */
export function CollapsibleTopBar({
  loading = false,
  headerRow,
  // gradient/shadow/tone מוחלים רק ב-variant="colored".
  gradient = BAR_GRADIENT,
  shadow = BAR_SHADOW,
  tone = "blue",
  variant = "transparent",
  onBack,
  menuHref,
  children,
  raised = false,
  forceReveal = false,
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
    // true = גלויה (בעקבות משיכה למטה בראש הדף). false = מוסתרת (ברירת
    // המחדל - גם בטעינה הראשונה, לפני כל אינטראקציה).
    // כאשר נפתח ההסבר מתוך "צור טיול", שורת החיפוש חייבת להיות גלויה
    // מיד. זה override חד-פעמי לפתיחה בלבד; סגירה בגלילה נשארת כרגיל.
    let revealed = forceReveal;
    // מיקום ה-touch ההתחלתי, רק אם המשיכה התחילה בראש הדף ממש
    // (scrollY<=0) - אחרת null, ואין מעקב אחרי המחווה הזו בכלל.
    let touchStartY: number | null = null;
    let raf = 0;

    function apply() {
      raf = 0;
      if (!bar || !clip || !naturalHeight) return;
      if (revealed) {
        // מצב גלוי: הכל חוזר לטבעי (גם כדי שתפריט ההצעות יוכל לצאת מהבר).
        clip.style.height = "";
        clip.style.overflow = "";
        clip.style.pointerEvents = "";
        return;
      }
      // מצב מוסתר: accordion רגיל ל-0px (בלי margin-bottom/transform
      // מפצה - ר' ההערה למעלה).
      clip.style.height = "0px";
      clip.style.overflow = "hidden";
      clip.style.pointerEvents = "none";
    }

    function onTouchStart(e: TouchEvent) {
      touchStartY = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartY == null || revealed) return;
      const deltaY = e.touches[0].clientY - touchStartY;
      // סף קטן (6px) רק כדי לסנן רעד/נגיעה מקרית - לא "משיכה הדרגתית":
      // מעבר לסף, השורה מופיעה מיד במלואה (בקשה מפורשת).
      if (deltaY > 6) {
        revealed = true;
        if (!raf) raf = requestAnimationFrame(apply);
      }
    }

    function onTouchEnd() {
      touchStartY = null;
    }

    function onScroll() {
      const scrollY = Math.max(0, window.scrollY);
      // בזמן הסבר "צור טיול" שורת החיפוש חייבת להישאר פתוחה.
      // ה-smooth scroll לראש והנעילה של ה-overlay יכולים לייצר אירועי
      // scroll אחרי שה-forceReveal הופעל; אסור לאירועים האלה לסגור אותה.
      if (forceReveal) return;

      // במצב הרגיל: גלילה אמיתית של הדף סוגרת שוב שורה שנחשפה.
      if (revealed && scrollY > 4) {
        revealed = false;
        if (!raf) raf = requestAnimationFrame(apply);
      }
    }

    function onResize() {
      // מודדים מחדש רק כשהשורה גלויה (אחרת ה-offsetHeight הנוכחי מכווץ).
      if (revealed && content) naturalHeight = content.offsetHeight;
      if (!raf) raf = requestAnimationFrame(apply);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    apply();
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [collapsible, forceReveal]);

  // *** בר עליון חדש (בקשה מפורשת - "רק הלוגו, רקע שקוף; נגלל עם העמוד,
  // אבל כשעולים למעלה הוא מופיע"): headroom - גלילה למטה מסתירה את הבר
  // (translateY(-100%)), גלילה למעלה מחזירה אותו. בראש הדף הוא שקוף לגמרי;
  // כשהוא חוזר מעל תוכן (באמצע הדף) הוא מקבל רקע לבן-שקוף עדין עם טשטוש,
  // כדי שהלוגו והכפתורים לא יתערבבו עם התוכן שמתחתיו. מעודכן ישירות על
  // ה-DOM (לא state) - בלי רינדור בכל פריים.
  const colored = variant === "colored";
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let lastY = Math.max(0, window.scrollY);
    let hidden = false;
    let raf = 0;
    const THRESHOLD = 6;

    function update() {
      raf = 0;
      if (!bar) return;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      const barHeight = bar.offsetHeight;
      if (raised || forceReveal || y <= barHeight) {
        hidden = false;
        lastY = y;
      } else if (delta > THRESHOLD) {
        hidden = true;
        lastY = y;
      } else if (delta < -THRESHOLD) {
        hidden = false;
        lastY = y;
      }
      if (colored) {
        // בר צבעוני: הרקע תמיד הגרדיאנט - רק ההסתרה/חשיפה בגלילה.
        bar.style.transform = hidden ? "translateY(-100%)" : "";
        return;
      }
      const floating = !hidden && y > 4;
      bar.style.transform = hidden ? "translateY(-100%)" : "";
      bar.style.backgroundColor = floating ? "rgba(255, 255, 255, 0.82)" : "transparent";
      bar.style.backdropFilter = floating ? "blur(14px)" : "";
      (bar.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = floating ? "blur(14px)" : "";
      bar.style.boxShadow = floating ? "0 8px 24px -16px rgba(16, 24, 40, 0.35)" : "none";
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [raised, forceReveal, colored]);

  return (
    <div
      ref={barRef}
      data-home-top-bar=""
      className={`sticky top-0 ${colored ? "rounded-b-[32px] pb-5" : "pb-3"} ${raised ? "z-[65]" : "z-30"}`}
      style={{
        ...(colored ? { background: gradient, boxShadow: shadow } : { backgroundColor: "transparent" }),
        transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease, box-shadow 200ms ease",
        willChange: "transform",
      }}
    >
      {colored && <AnimatedHeaderBackdrop tone={tone} />}
      {headerRow ?? <HomeHeader loading={loading} onBack={onBack} menuHref={menuHref} />}

      {collapsible && (
        <div ref={clipRef} style={{ transition: "height 160ms ease" }}>
          <div ref={contentRef} data-collapsible-content="" className="px-5 pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
