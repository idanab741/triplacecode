"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface ChatHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

export function ChatHeader({ current, total, onBack }: ChatHeaderProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
          {onBack && <BackButton onBack={onBack} />}
        </div>

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 pr-[7px]">
          {/* *** תוספת (בקשה מפורשת - "עיגול ירוק מתחת לעיגול של הפרופיל
              בבר העליון, שיראה כמו 'מחובר'"): נקודת "online" קלאסית -
              עיגול ירוק קטן בפינה של האווטאר. הוצאתי אותה *מחוץ* ל-div
              עם overflow-hidden (שעוטף רק את התמונה עצמה) - אחרת היא
              הייתה נחתכת, כי היא יושבת בקצה/מעבר לגבול העיגול. */}
          <div className="relative h-[34px] w-[34px] shrink-0">
            <div className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-white shadow-sm">
              <Image src="/images/tripy.png" alt="Tripy" fill className="object-cover" priority />
            </div>
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
          </div>
          <p className="text-lg font-bold leading-tight text-ink">טריפי AI</p>
        </div>
      </div>

      <div className="h-1.5 w-full bg-ink-secondary/10">
        <div
          className="h-full rounded-l-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))",
          }}
        />
      </div>
    </header>
  );
}
