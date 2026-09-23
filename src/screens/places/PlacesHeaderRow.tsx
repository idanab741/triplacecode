"use client";

import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui";
import { PlacesNotificationBell } from "./PlacesNotificationBell";

/** גרדיאנט וצל הבר הסגול של place's - מקור אמת יחיד לכל מי שמשתמש בו. */
/** *** מרוכך (בקשה מפורשת - "פער בצבע ו-צל מיותר"): הגרדיאנט עם פחות קפיצה בין הצד
 *  הבהיר לכהה (היה violet #a855f7 -> dark #5b21b6, קפיצה חדה), ובלי צל מתחת לבר. */
export const PLACES_BAR_GRADIENT = "linear-gradient(150deg, #8443EF 0%, #7C3AED 50%, #6D30DF 100%)";
export const PLACES_BAR_SHADOW = "none";

const WHITE_CIRCLE =
  "flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(50,10,120,0.45)]";

/**
 * שורת הכותרת העליונה של הבר הסגול של place's. *** אותה שורה בדיוק, במיקום
 * ובמידות זהים, כמו HomeHeader של עמוד הבית (grid-cols-[40px_1fr_40px], px-5,
 * pt-3): צ'אט מימין, לוגו במרכז, פעמון משמאל - כך ש"המיקום בעמוד זהה" בין
 * triplace ל-place's. הלוגו בלבן (אותו קובץ, brightness(0) invert(1)).
 * הפעמון והצ'אט - אלה הקיימים של place's (התראות חברתיות + צ'אט place's).
 * עם onBack: כפתור החזרה של האפליקציה מחליף את הצ'אט.
 */
export function PlacesHeaderRow({
  onBack,
  menuHref,
  logoTone = "brand",
  badgeTone = "blue",
}: {
  onBack?: () => void;
  menuHref?: string;
  /** "white" - לוגו לבן על הבר הצבעוני (בית / place's). ברירת מחדל: סגול (בר שקוף). */
  logoTone?: "brand" | "white";
  /** צבע עיגול מונה ההתראות - "purple" רק בבית ובמפה (בקשה מפורשת). */
  badgeTone?: "blue" | "purple";
}) {
  return (
    <header className="relative z-10 grid h-[52px] grid-cols-[40px_1fr_40px] items-center px-5 pt-3 pb-0">
      {onBack ? (
        <div className={WHITE_CIRCLE}>
          <BackButton onBack={onBack} />
        </div>
      ) : (
        <Link href="/places/chat" aria-label="צ'אט" className={WHITE_CIRCLE}>
          <Image src="/images/places-chat-icon.png" alt="" width={22} height={20} className="object-contain" />
        </Link>
      )}

      {/* עוטף בגובה קבוע 40px - זהה ל-HomeHeader (הלוגו לא משפיע על גובה השורה).
          *** בקשה מפורשת - "הגודל של הלוגו לא זהה ל-triplace": נמדד מהצילומים - הכיתוב
          של triplace גבוה 34px (מהעולה ל-l עד היורד של p), ושל place's היה 40px בתיבה
          150x46. תיבה מוקטנת ב-0.85 (128x39) נותנת בדיוק 34px - אותו גודל אות. */}
      <div className="flex h-10 items-center justify-center">
        {/* *** בר שקוף (בקשה מפורשת): הלוגו בסגול של place's. נצבע דרך CSS
            mask מאותו קובץ לוגו - הצורה זהה ב-100%, רק הצבע משתנה. */}
        <span
          role="img"
          aria-label="place's"
          className="block h-[39px] w-[128px] select-none"
          style={{
            backgroundColor: logoTone === "white" ? "#ffffff" : "var(--color-places-purple)",
            WebkitMaskImage: "url(/images/places-logo.png)",
            maskImage: "url(/images/places-logo.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      </div>

      <div className="justify-self-end">
        {/* menuHref (עמוד הפרופיל שלי): תפריט שלוש-הפסים מחליף את הפעמון, באותו עיגול לבן ובאותו מיקום. */}
        {menuHref ? (
          <Link href={menuHref} aria-label="תפריט" className={WHITE_CIRCLE}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b21b6" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </Link>
        ) : (
          <PlacesNotificationBell solid badgeTone={badgeTone} />
        )}
      </div>
    </header>
  );
}
