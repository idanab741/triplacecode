"use client";

import type { ReactNode } from "react";
import Image from "next/image";

interface TripHeroHeaderProps {
  heroSrc: string;
  heroAlt?: string;
  onBack: () => void;
  /** תוכן חופשי בצד ימין (למשל SaveTripIconButton + כפתור שיתוף). חשוב:
   *  הצבע של התוכן הזה (לבן/רגיל) הוא באחריות הקורא - לא נכפה כאן, ר'
   *  WHITE_ICON_FILTER/DARK_AREA_ICON_STYLE למטה. */
  rightSlot?: ReactNode;
  /** *** תוספת (בקשה מפורשת - "לא הכל צריך להיות לבן - רק מה שעם רקע
   *  כהה! מה שרקע בהיר - הלוגו יכול להישאר [בצבעו המקורי]"): true רק
   *  כשהאזור העליון של תמונת ה-HERO הספציפית הזו כהה מספיק (למשל שמי
   *  לילה כהים ב"חיי לילה") שבלעדיו לוגו/אייקונים שחורים לא יהיו
   *  קריאים. ברירת המחדל false (רוב התמונות - שמיים/רקעים בהירים) -
   *  הלוגו נשאר בצבעו המקורי (שחור), רק עם הילה לבנה עדינה להבחנה.
   */
  dark?: boolean;
}

/** להשתמש כש-dark=true - הופך את הלוגו/אייקונים ללבן מלא (brightness(0)
 *  + invert), עם drop-shadow כהה עדין לקריאות. */
export const WHITE_ICON_FILTER = "brightness-0 invert drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]";

/** להשתמש כש-dark=false (ברירת המחדל) - משאיר את הצבע המקורי (שחור),
 *  רק מוסיף הילה לבנה-עדינה מאחורי הצורה לשיפור ניגודיות מול רקע בהיר/
 *  צבעוני, בלי לשנות את הצבע עצמו. */
export const LIGHT_AREA_ICON_STYLE = "drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]";

/**
 * *** תוספת (בקשה מפורשת - "הבר העליון... שהכל יהיה שקוף... כמו
 * בתפריט tripmatch מדף הבית - שהלוגו באמצע, כפתור חזור נשאר באותו
 * מיקום"): מחליף את הבר הלבן האטום (bg-white shadow-sm) שהיה בכל אחד
 * מ-7 עמודי תוצאת-הטיול בבר שקוף לגמרי שיושב **מעל** תמונת ה-HERO
 * (position absolute, לא דוחף אותה למטה) - אותו מבנה בדיוק כמו הבר
 * הממורכז ב-home/page.tsx (מצב TripMatch מוטמע): כפתור חזרה absolute
 * משמאל (עמדה קבועה), לוגו TRIPLACE ממורכז אמיתי באמצע (140x43 - אותו
 * גודל בדיוק כמו לוגו tripmatch שם), ותוכן חופשי (rightSlot) absolute
 * מימין. בלי אנימציית כניסה (הוסרה - בקשה מפורשת).
 */
export function TripHeroHeader({ heroSrc, heroAlt = "", onBack, rightSlot, dark = false }: TripHeroHeaderProps) {
  const logoStyle = dark ? WHITE_ICON_FILTER : LIGHT_AREA_ICON_STYLE;

  return (
    <div className="relative w-full">
      <Image src={heroSrc} alt={heroAlt} width={800} height={450} priority className="h-auto w-full" />

      <header className="absolute inset-x-0 top-0 z-30 w-full">
        <div className="relative flex h-16 items-center justify-center px-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="חזרה"
            className="absolute left-2 flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dark ? "white" : "black"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={dark ? "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" : LIGHT_AREA_ICON_STYLE}
            >
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>

          <Image
            src="/images/triplace-logo-black.png"
            alt=""
            width={140}
            height={43}
            className={`object-contain ${logoStyle}`}
          />

          {rightSlot && <div className="absolute right-2 flex items-center gap-1">{rightSlot}</div>}
        </div>
      </header>
    </div>
  );
}
