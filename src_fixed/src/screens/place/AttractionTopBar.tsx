"use client";

import { PlacesNotificationBell } from "@/screens/places/PlacesNotificationBell";

/** גרדיאנט הבר התכלת של עמודי אטרקציה - מקור אמת יחיד, בדיוק כמו
 *  PLACES_BAR_GRADIENT (הסגול) של PlacesHeaderRow.tsx - אותו רעיון,
 *  צבע אחר (התכלת/כחול הראשי של האפליקציה, לא הסגול של place's). */
export const ATTRACTION_BAR_GRADIENT = "linear-gradient(150deg, var(--color-primary-start) 0%, var(--color-primary-end) 100%)";

const WHITE_CIRCLE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(0,50,120,0.35)]";

interface AttractionTopBarProps {
  backHref?: string;
}

/**
 * *** חדש (בקשה מפורשת - "בר עליון בצבע תכלת עם כפתורי חזור ופעמון
 * בצדדים... זה צריך להיות אחיד לכל העמודים של האטרקציות"): בר סטטי
 * מלא-רוחב, **לא** overlay שקוף על התמונה (כמו PlaceHeroActions הישן) -
 * יושב מעל ה-HERO בזרימה הרגילה של העמוד. אותה שפה חזותית בדיוק כמו
 * PlacesHeaderRow.tsx (עיגולים לבנים, אותו גובה 52px) - רק בגרדיאנט
 * התכלת הראשי של האפליקציה במקום הסגול של place's, וללא לוגו/צ'אט
 * במרכז (שם המקום כבר מוצג בגוף העמוד, מיד מתחת לתמונה).
 */
export function AttractionTopBar({ backHref }: AttractionTopBarProps) {
  return (
    <header className="relative z-10 flex h-[52px] items-center justify-between px-4" style={{ background: ATTRACTION_BAR_GRADIENT }}>
      <button
        type="button"
        onClick={() => {
          if (backHref) {
            window.location.href = backHref;
          } else {
            window.history.back();
          }
        }}
        aria-label="חזרה"
        className={WHITE_CIRCLE}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-end)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "scaleX(-1)" }}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>

      <PlacesNotificationBell solid />
    </header>
  );
}
