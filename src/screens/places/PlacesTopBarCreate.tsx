"use client";

import Link from "next/link";

interface PlacesTopBarCreateProps {
  onCreate: () => void;
}

/**
 * *** עדכון (בקשה מפורשת - "שיהיה הפוך - העיגול עם הפלוס במקום הזכוכית מגדלת,
 * ובחיפוש יהיה כתוב 'חפש ב-place's'", + "לא מודגש ולא סגול, רגיל כמו ב-triplace",
 * + "יש כבר זכוכית מגדלת - רק שתהיה בסגול בעמוד place's"): השורה השנייה של הבר
 * הסגול - באותו מקום, גובה (48px), רוחב וצורה כמו שורת החיפוש של triplace:
 *  - בצד הימני: אותה זכוכית מגדלת בדיוק כמו ב-SearchBarLink (hero) - אותו SVG,
 *    אותו גודל ועובי - רק בצבע הסגול של place's, ולידה "חפש ב-place's" בטקסט
 *    רגיל (כמו ה-placeholder ב-triplace, באותו גודל 16px - ב-SearchBarLink זה
 *    input ש-globals.css מכריח ל-16px בנייד). הכול קישור ל-/places/search.
 *  - בקצה השמאלי - אחרי הקו המפריד: העיגול עם הפלוס, שפותח את אותו
 *    CreateMenuSheet של "צור תוכן חדש".
 */
export function PlacesTopBarCreate({ onCreate }: PlacesTopBarCreateProps) {
  return (
    <div className="flex h-12 items-center gap-2.5 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_6px_18px_-8px_rgba(50,10,120,0.28)] ring-1 ring-black/[0.06]">
      <Link href="/places/search" aria-label="חיפוש ב-place's" className="flex min-w-0 flex-1 items-center gap-2.5 text-right">
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-places-purple)"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="truncate text-[16px] font-normal text-ink-secondary">חפש ב-place&apos;s</span>
      </Link>

      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink-secondary/20" />
      <button
        type="button"
        onClick={onCreate}
        aria-label="צור תוכן חדש"
        className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[17px] font-bold leading-none text-white"
          style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
        >
          +
        </span>
      </button>
    </div>
  );
}
