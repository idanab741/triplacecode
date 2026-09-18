"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface SwipeHeaderProps {
  city: string;
  categoryLabel: string;
  currentIndex: number;
  total: number;
  onBack: () => void;
  onEditDestination: () => void;
  onEditCategory: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  /** שינוי (בקשה מפורשת - "בחירת קטגוריה אופציונלית, לא חובה"): כש-true,
   *  ה-pill של קטגוריה+עריכה לא מוצג בכלל - במצב "הכל" (ברירת המחדל
   *  החדשה) עריכת קטגוריה כבר קורית דרך עיגולי הסינון מתחת, לא דרך
   *  מסך בחירה חוסם נפרד. ברירת המחדל false שומרת על ההתנהגות הקיימת
   *  לזרימות שעדיין תלויות בקטגוריה בודדת אמיתית ("קרוב אליי"/"המשך
   *  לקטגוריה הבאה"). */
  hideCategoryPill?: boolean;
  /** תיקון (Home - מוטמע): כש-true, מסתיר את הבר הלבן העליון (לוגו
   *  TripMatch + חזרה + פילטרים) - Home כבר מציג לוגו+חזרה משלה מעל
   *  Trip Types. ה-pills של עיר/קטגוריה ופס ההתקדמות מתחת (כולל כפתור
   *  "סיימתי לסרוק") נשארים בכל מקרה - הם לא חלק מהבר הזה. ברירת המחדל
   *  false שומרת על ההתנהגות הקיימת בעמוד /tripmatch העצמאי. */
  hideTopBar?: boolean;
}

export function SwipeHeader({
  city,
  categoryLabel,
  currentIndex,
  total,
  onBack,
  onEditDestination,
  onEditCategory,
  onOpenFilters,
  activeFilterCount,
  hideTopBar = false,
  hideCategoryPill = false,
}: SwipeHeaderProps) {
  const progressPct = total > 0 ? Math.min(100, (currentIndex / total) * 100) : 0;

  return (
    <>
      {!hideTopBar && (
        <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
          <div className="relative h-16">
            <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
              <BackButton onBack={onBack} />
            </div>

            <button
              type="button"
              onClick={onOpenFilters}
              aria-label="פילטרים"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-soft"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-start)" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      <div className="flex flex-col gap-3 px-5 pt-3">

      <div className="flex items-center gap-2">
        {/* תיקון (בקשה מפורשת - "לא צריך פה כפתור חזור!! יש למעלה!" +
            "שהפילטר והקטגוריות יהיו באותה שורה"): כש-hideTopBar=true
            (מוטמע), אין יותר כפתור חזור נפרד כאן בכלל (Home כבר מציגה
            אחד משלה מעל) - הפילטר עבר לשבת באותה שורה בדיוק עם ה-pills
            של יעד/קטגוריה, לא בשורה נפרדת מעליהם. */}
        {hideTopBar && (
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label="פילטרים"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-soft"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-start)" strokeWidth="2.4" strokeLinecap="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
        {/* *** שדרוג ויזואלי (בקשה מפורשת - "זה קצת מיושן, פורמט אחר
            שיותאם לאפליקציה"): רקע לבן+shadow-soft (כמו שאר הכפתורים
            החדשים בעמוד הבית) במקום אפור שטוח, אייקון נעץ SVG אמיתי
            (אותו path בדיוק כמו ב-TripMatchCard) במקום אימוג'י "📍",
            וחץ-למטה עדין במקום "✎" כדי לרמוז "לחיצה = שינוי". */}
        <button
          type="button"
          onClick={onEditDestination}
          className="flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-primary-start)" aria-hidden="true">
            <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
          </svg>
          {city}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-secondary">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {!hideCategoryPill && (
          <button
            type="button"
            onClick={onEditCategory}
            className="flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-soft"
          >
            {categoryLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-secondary">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-secondary">
          <div
            className="h-full rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      </div>
    </>
  );
}
