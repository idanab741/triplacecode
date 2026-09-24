"use client";

import Image from "next/image";

/**
 * Header של עמוד TripWorld החדש (סעיף 3 בפרומפט - "לוגו TRIPLACE +
 * כותרת ברורה: TripWorld"). זהו טאב ראשי (מגיע מה-Bottom Navigation),
 * לא מסך-משנה - לכן בלי כפתור חזרה, בדומה למבנה של PlacesHeader.tsx
 * הקיים (sticky, לבן, לוגו ממורכז) - לא נבנה דפוס header חדש, רק
 * מחזור אותו סגנון עם כותרת טקסט לצידו.
 */
export function TripWorldHeader() {
  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="flex h-16 items-center justify-center gap-2 px-5">
        <Image src="/images/triplace-logo-black.png" alt="TRIPLACE" width={174} height={53} className="-my-[7px] h-[53px] w-[174px] max-w-none object-contain" />
        <span className="h-5 w-px bg-ink-secondary/20" />
        <h1 className="text-lg font-bold text-ink">TripWorld</h1>
      </div>
    </header>
  );
}
