"use client";

import Link from "next/link";

/** נקודת הכניסה האמיתית ל-place's מתוך עמוד הבית הקיים. אלמנט תוסף
 *  בלבד (לא נוגע בבר הניווט התחתון, שכבר מלא ב-5 טאבים, ולא ב-HomeHeader
 *  שכבר grid קבוע של 3 עמודות - שניהם היו נשברים אם היינו דוחסים לשם
 *  עוד אייקון). ממוקם בזרימת ה-Sections הקיימת בעמוד הבית. */
export function PlacesEntryBanner() {
  return (
    <Link
      href="/places"
      className="mx-6 flex items-center gap-3 rounded-card px-4 py-4 text-white shadow-soft"
      style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">👋</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">
          place<span className="opacity-80">&apos;</span>s
        </span>
        <span className="block text-[12.5px] text-white/85">ראה מה מטיילים אחרים עושים, עקוב אחרי יוצרים ושתף את הטיולים שלך</span>
      </span>
      <span className="text-lg">←</span>
    </Link>
  );
}
