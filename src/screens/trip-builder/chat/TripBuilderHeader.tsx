"use client";

import Image from "next/image";

interface TripBuilderHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

/** Header למסכי השאלות של בניית מסלול (7 סוגי טיול) - לוגו Triplace + חזור,
 *  באותו עיצוב/גודל בדיוק כמו הבאנר בעמודי התוצאה (left-2/top-4, 130x40).
 *  שונה בכוונה מ-ChatHeader (שנשאר ייעודי לעמוד הצ'אט "טריפי AI" בלבד) -
 *  אבל שומר על אותו Progress Bar. */
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
