"use client";

import Image from "next/image";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";

const BLUE = "#0A6DFE";

const LABELS: Record<HomeQuickCategoryId, string> = {
  attraction: "אטרקציות",
  food: "אוכל",
  shopping: "שופינג",
  nature: "טבע",
  nightlife: "חיי לילה",
  sleep: "לינה",
};

interface TripMatchCategoryChipsProps {
  /** קטגוריות שנבחרו (בחירה מרובה). ריק = "הכל". */
  selected: HomeQuickCategoryId[];
  onToggle: (id: HomeQuickCategoryId) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

/**
 * שורת הסינון של עמוד ההחלקות - אותה שפה בדיוק כמו שורת הסינון ב"כל מה שחם" (/hot):
 * גלולות h-10 אפורות-בהירות עם אייקון עגול, והנבחרת בכחול המותג. ראשון מימין - כפתור
 * "סינון" (פותח את חלון הסינון המלא), אחריו "הכל" ואז הקטגוריות.
 */
export function TripMatchCategoryChips({ selected, onToggle, onClear, onOpenFilters, activeFilterCount }: TripMatchCategoryChipsProps) {
  const chip = "flex h-10 shrink-0 items-center gap-2 rounded-full text-[14px] font-semibold transition active:scale-95";
  const allSelected = selected.length === 0;
  return (
    <div className="stories-rail-track flex w-full min-w-0 max-w-full gap-2 overflow-x-auto px-4 pb-1 pt-1" style={{ scrollbarWidth: "none" }}>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="סינון"
        className={`${chip} relative bg-[#F1F2F5] px-3.5 text-ink`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        סינון
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: BLUE }}>
            {activeFilterCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onClear}
        aria-pressed={allSelected}
        className={`${chip} px-4 ${allSelected ? "text-white" : "bg-[#F1F2F5] text-ink"}`}
        style={allSelected ? { background: BLUE } : undefined}
      >
        הכל
      </button>

      {HOME_QUICK_CATEGORIES.map((category) => {
        const isSelected = selected.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onToggle(category.id)}
            aria-pressed={isSelected}
            className={`${chip} pe-4 ps-1.5 ${isSelected ? "text-white" : "bg-[#F1F2F5] text-ink"}`}
            style={isSelected ? { background: BLUE } : undefined}
          >
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white">
              <Image src={category.imageSrc} alt="" fill sizes="28px" className="scale-125 object-cover" />
            </span>
            {LABELS[category.id]}
          </button>
        );
      })}
      <div aria-hidden className="w-2 shrink-0" />
    </div>
  );
}
