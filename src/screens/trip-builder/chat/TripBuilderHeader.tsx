"use client";

import Image from "next/image";

interface TripBuilderHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

/** Header למסכי השאלות של בניית מסלול (7 סוגי טיול) - עיגון פיזי מפורש
 *  (left-2/right-2), לא flex+justify-between, כדי שזה לא יתהפך לפי RTL:
 *  לוגו Triplace + חזור תמיד ב-left הפיזי, אווטאר טריפי + "טריפי AI"
 *  תמיד ב-right הפיזי (הכי ימני בעמוד). אותו גודל לוגו (130x40) כמו בכל
 *  מקום אחר באפליקציה (TripMatch, עמודי תוצאה). אותו Progress Bar כמו קודם. */
export function TripBuilderHeader({ current, total, onBack }: TripBuilderHeaderProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-4 flex items-center gap-2">
          <Image src="/images/trip-triplace-logo.png" alt="" width={130} height={40} className="object-contain" />
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            aria-label="חזרה לדף הבית"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        <div className="absolute right-2 top-4 flex items-center gap-2">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
            <Image src="/images/tripy.png" alt="Tripy" fill className="object-cover" priority />
          </div>
          <p className="text-[15px] font-bold leading-tight text-ink">טריפי AI</p>
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
