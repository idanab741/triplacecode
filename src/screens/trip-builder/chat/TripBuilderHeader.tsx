"use client";

import Image from "next/image";

interface TripBuilderHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

/** Header למסכי השאלות של בניית מסלול (7 סוגי טיול) - משלב את שני
 *  הצדדים: מימין נשאר בדיוק כמו ChatHeader (אווטאר טריפי + "טריפי AI"),
 *  ומשמאל נוסף לוגו Triplace + חזור (כמו בעמודי התוצאה). אותו Progress
 *  Bar כמו קודם, ללא שינוי. */
export function TripBuilderHeader({ current, total, onBack }: TripBuilderHeaderProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-ink">טריפי AI</p>
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
            <Image src="/images/tripy.png" alt="Tripy" fill className="object-cover" priority />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Image src="/images/trip-triplace-logo.png" alt="" width={110} height={34} className="object-contain" />
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            aria-label="חזרה לדף הבית"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-secondary transition hover:bg-ink-secondary/10 disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
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
