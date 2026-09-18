"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface SupportChatHeaderProps {
  onBack: () => void;
}

/** אווטאר שירות לקוחות - אייקון headset בגרדיאנט המותג, לא הדמות/הלוגו
 *  של טריפי (Trippy AI). מזוהה בבירור כ"נציג אנושי", לא כ-AI. */
function SupportAvatar() {
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5Z" />
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" />
      </svg>
    </span>
  );
}

/**
 * Header של צ'אט שירות הלקוחות - אותה שפה חזותית בדיוק כמו ChatHeader.tsx
 * של Trippy AI (לוגו משמאל, כפתור חזרה, אווטאר+נקודת "online" מימין),
 * אבל בלי progress bar (אין שלבים/שאלון כאן) ועם אווטאר/כותרת ששייכים
 * במפורש לשירות לקוחות אנושי - "TRIPLACE שירות לקוחות", לא "טריפי AI".
 */
export function SupportChatHeader({ onBack }: SupportChatHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
          <BackButton onBack={onBack} />
        </div>

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 pr-[7px]">
          <div className="relative h-[34px] w-[34px] shrink-0">
            <div className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-white shadow-sm">
              <SupportAvatar />
            </div>
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
          </div>
          <p className="text-lg font-bold leading-tight text-ink">TRIPLACE שירות לקוחות</p>
        </div>
      </div>
    </header>
  );
}
