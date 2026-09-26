"use client";

import { TRIPLACE_LOGO_STYLE } from "@/components/ui/triplaceLogo";


/**
 * Header של עמוד TripWorld החדש (סעיף 3 בפרומפט - "לוגו TRIPLACE +
 * כותרת ברורה: TripWorld"). זהו טאב ראשי (מגיע מה-Bottom Navigation),
 * לא מסך-משנה - לכן בלי כפתור חזרה, בדומה למבנה של PlacesHeader.tsx
 * הקיים (sticky, לבן, לוגו ממורכז) - לא נבנה דפוס header חדש, רק
 * מחזור אותו סגנון עם כותרת טקסט לצידו.
 */
export function TripWorldHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 w-full border-b border-black/[0.06] bg-white">
      <div className="flex h-16 items-center justify-center gap-2 px-5">
        <span
            role="img"
            aria-label="TRIPLACE"
            className="-my-[7px] block h-[53px] w-[174px] shrink-0 select-none"
            style={TRIPLACE_LOGO_STYLE}
          />
        <span className="h-5 w-px bg-ink-secondary/20" />
        <h1 className="text-lg font-bold text-ink">TripWorld</h1>
      </div>
    </header>
  );
}
