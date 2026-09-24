"use client";

import { useState } from "react";
import { BackButton } from "@/components/ui";

interface SupportChatHeaderProps {
  onBack: () => void;
}

/** טריפי (trippy-avatar). אם הקובץ לא נטען - אייקון אוזניות, כדי שלא יופיע עיגול שבור. */
function SupportAvatar() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[#0A6DFE] text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5Z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" />
        </svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/trippy-avatar.png" alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

/**
 * *** בקשה מפורשת ("הכותרת לא זהה לעמודי הצ'אט החדשים - בלי triplace, וכפתור חזור בצד ימין, עם התמונה של
 * trippy"): אותו מבנה בדיוק כמו DmChatHeader - בר לבן בגובה 64px, כפתור חזרה בהתחלה (ימין ב-RTL), ואחריו
 * אווטאר (טריפי) עם נקודת "מחובר" ירוקה, השם ותת-כותרת. בלי לוגו triplace.
 */
export function SupportChatHeader({ onBack }: SupportChatHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-3 bg-white px-2 shadow-sm">
      <BackButton onBack={onBack} />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="relative h-9 w-9 shrink-0">
          <span className="block h-full w-full overflow-hidden rounded-full bg-bg-secondary">
            <SupportAvatar />
          </span>
          <span className="absolute -bottom-0.5 -start-0.5 h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-white" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-bold leading-tight text-ink">שירות לקוחות</span>
          <span className="block truncate text-[12.5px] leading-tight text-ink-secondary">צוות triplace</span>
        </span>
      </div>
    </header>
  );
}
