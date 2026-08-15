"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface SwipeHeaderProps {
  city: string;
  categoryLabel: string;
  currentIndex: number;
  total: number;
  onBack: () => void;
  onEditDestination: () => void;
  onEditCategory: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  onFinish: () => void;
}

export function SwipeHeader({
  city,
  categoryLabel,
  currentIndex,
  total,
  onBack,
  onEditDestination,
  onEditCategory,
  onOpenFilters,
  activeFilterCount,
  onFinish,
}: SwipeHeaderProps) {
  const progressPct = total > 0 ? Math.min(100, (currentIndex / total) * 100) : 0;

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
        <div className="relative h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
            <BackButton onBack={onBack} />
          </div>

          <button
            type="button"
            onClick={onOpenFilters}
            aria-label="פילטרים"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-ink"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-5 pt-3">

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEditDestination}
          className="flex items-center gap-1 rounded-pill bg-bg-secondary px-3 py-1.5 text-[12.5px] font-semibold text-ink"
        >
          📍 {city}
          <span className="text-ink-secondary">✎</span>
        </button>
        <button
          type="button"
          onClick={onEditCategory}
          className="flex items-center gap-1 rounded-pill bg-bg-secondary px-3 py-1.5 text-[12.5px] font-semibold text-ink"
        >
          {categoryLabel}
          <span className="text-ink-secondary">✎</span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-secondary">
          <div
            className="h-full rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-ink-secondary">
            {Math.min(currentIndex + 1, total)} מתוך {total}
          </span>
          <button type="button" onClick={onFinish} className="text-[12px] font-semibold text-accent">
            סיימתי לסרוק ✓
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
