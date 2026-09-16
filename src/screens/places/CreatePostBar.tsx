"use client";

import Link from "next/link";
import Image from "next/image";
import { getAvatarUrl } from "@/constants/avatar";

interface CreatePostBarProps {
  avatarUrl?: string | null;
  onClick: () => void;
}

/**
 * שורת "כתבו את הטיול שלכם" - נקודת הכניסה המרכזית ליצירת תוכן ב-
 * place's, ממוקמת מעל Stories ומתחת ל-Header.
 *
 * *** תוספת (בקשה מפורשת - "תעביר את הזכוכית מגדלת לקצה השמאלי של
 * השורה הזו, בקו ישר מתחת לפעמון"): אייקון החיפוש עבר לכאן מ-
 * PlacesHeader.tsx (שם נשאר רק כפתור הצ'אט). ה-`absolute left-5`
 * כאן הוא **בדיוק** אותו מיקום ש-PlacesHeader.tsx נותן לפעמון עצמו
 * (גם שם `left-5`, גם שם עיגול h-10 w-10) - לא קירוב, יישור מדויק
 * פיקסל-לפיקסל על אותה עמודה אנכית.
 *
 * מבנה: קודם זה היה button יחיד לכל השורה - הוחלף ל-div חיצוני עם
 * שני אלמנטים לחיצים נפרדים (button אחד לפתיחת יצירת-פוסט, Link אחד
 * לחיפוש) - button לא יכול להיות מקונן בתוך button אחר.
 */
export function CreatePostBar({ avatarUrl, onClick }: CreatePostBarProps) {
  return (
    <div className="relative flex w-full items-center border-b border-ink-secondary/10 bg-white px-4 py-3">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 pe-12 text-start">
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1 rounded-pill bg-bg-secondary px-4 py-2.5 text-[13.5px] text-ink-secondary">
          כתבו את הטיול שלכם
        </span>
      </button>

      <Link
        href="/places/search"
        aria-label="חיפוש"
        className="absolute left-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
      >
        <Image src="/images/places-search-icon.png" alt="" width={21} height={20} className="object-contain" />
      </Link>
    </div>
  );
}
