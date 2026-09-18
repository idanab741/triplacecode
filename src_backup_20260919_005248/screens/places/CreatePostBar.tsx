"use client";

import Link from "next/link";
import Image from "next/image";

interface CreatePostBarProps {
  onClick: () => void;
}

/**
 * *** עיצוב-מחדש (בקשה מפורשת - "כפתור צור תוכן חדש יכול להחליף את
 * 'כתבו את הטיול שלכם' + עיגול תמונת הפרופיל, אבל להשאיר את הזכוכית
 * המגדלת"): לא עוד שורת "כתבו את הטיול שלכם" עם עיגול פרופיל - כפתור
 * מלא ברוחב, בגרדיאנט הסגול הרגיל, "צור תוכן חדש" - זהה בתפקוד
 * (פותח את אותו CreateMenuSheet) אבל שונה בעיצוב. הזכוכית המגדלת
 * (חיפוש) נשארת בדיוק באותו מיקום כמו קודם - לא זזה.
 *
 * *** תיקון (בקשה מפורשת - "תעביר את הזכוכית מגדלת לקצה השמאלי של
 * השורה הזו, בקו ישר מתחת לפעמון"): אייקון החיפוש עבר לכאן מ-
 * PlacesHeader.tsx (שם נשאר רק כפתור הצ'אט). ה-`absolute left-5`
 * כאן הוא **בדיוק** אותו מיקום ש-PlacesHeader.tsx נותן לפעמון עצמו
 * (גם שם `left-5`, גם שם עיגול h-10 w-10) - לא קירוב, יישור מדויק
 * פיקסל-לפיקסל על אותה עמודה אנכית.
 */
export function CreatePostBar({ onClick }: CreatePostBarProps) {
  return (
    <div className="flex w-full items-center gap-2.5 border-b border-ink-secondary/10 bg-white px-4 py-3">
      {/* *** תיקון (בקשה מפורשת - "הפרדה בין העיגול של הזכוכית המגדלת
          לצור תוכן חדש"): קודם הכפתור היה flex-1 עם padding בלבד
          והזכוכית absolute מעליו - הרקע הסגול של הכפתור נמשך *מתחת*
          לעיגול הזכוכית המגדלת (בלי רווח אמיתי, רק padding שלא באמת
          "חותך" את הרקע). עכשיו שניהם ילדי flex רגילים עם gap אמיתי
          ביניהם - אין יותר חפיפה בין הרקעים, יש רווח פיזי אמיתי. */}
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-pill py-2.5 text-[14px] font-bold text-white"
        style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none">+</span>
        צור תוכן חדש
      </button>

      <Link
        href="/places/search"
        aria-label="חיפוש"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
      >
        <Image src="/images/places-search-icon.png" alt="" width={21} height={20} className="object-contain" />
      </Link>
    </div>
  );
}
