"use client";

import Image from "next/image";

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
}

/** Header של מסך ההחלקות - בלי HERO ובלי דקורציה, רק מה שצריך כדי להתמצא:
 *  חזרה, יעד/קטגוריה כ-Chip לחיץ להחלפה, כפתור פילטרים, והתקדמות. */
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
}: SwipeHeaderProps) {
  const progressPct = total > 0 ? Math.min(100, (currentIndex / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 px-5 pt-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} aria-label="חזרה" className="flex h-9 w-9 items-center justify-center text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <Image src="/images/trip-tripmatch-logo.png" alt="TripMatch" width={110} height={34} className="object-contain" />
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label="פילטרים"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary text-ink"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

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
        <span className="text-[11.5px] font-medium text-ink-secondary">
          {Math.min(currentIndex + 1, total)} מתוך {total}
        </span>
      </div>
    </div>
  );
}
