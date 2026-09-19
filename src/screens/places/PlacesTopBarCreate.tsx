"use client";

import Link from "next/link";
import Image from "next/image";

interface PlacesTopBarCreateProps {
  onCreate: () => void;
}

/**
 * *** חדש (בקשה מפורשת - "איפה שורת החיפוש? ב-place's יהיה לה תפקיד אחר, והמיקום
 * זהה"): השורה השנייה של הבר הסגול - באותו מקום, באותו גובה (48px), באותו רוחב
 * ובאותה צורה כמו שורת החיפוש בבר של triplace (SearchBarLink hero), אבל עם תפקיד
 * אחר: כפתור "צור תוכן חדש" (פותח את אותו CreateMenuSheet שהיה ב-CreatePostBar),
 * ובקצה השמאלי - עם קו מפריד, בדיוק כמו כפתור המיקום בבית - החיפוש של place's.
 */
export function PlacesTopBarCreate({ onCreate }: PlacesTopBarCreateProps) {
  return (
    <div className="flex h-12 items-center gap-2.5 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_3px_8px_-4px_rgba(50,10,120,0.35)]">
      <button type="button" onClick={onCreate} className="flex min-w-0 flex-1 items-center gap-2.5 text-right">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[17px] font-bold leading-none text-white"
          style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
        >
          +
        </span>
        <span className="truncate font-bold text-places-purple">צור תוכן חדש</span>
      </button>

      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink-secondary/20" />
      <Link href="/places/search" aria-label="חיפוש" className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90">
        <Image src="/images/places-search-icon.png" alt="" width={22} height={21} className="object-contain" />
      </Link>
    </div>
  );
}
