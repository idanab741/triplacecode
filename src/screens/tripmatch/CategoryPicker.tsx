"use client";

import { TRIPMATCH_INTEREST_OPTIONS } from "@/locales/he/tripBuilder";

interface CategoryPickerProps {
  onSelect: (categoryValue: string, categoryLabel: string) => void;
}

/** שלב 2 - בחירת סוג מסלול יחיד. באותו סגנון בדיוק כמו כפתורי הקטגוריה
 *  במסך הפתיחה של טריפי AI (CategoryOptions.tsx) - Chip דק עם אייקון
 *  עגול, לא כרטיס גדול. */
export function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TRIPMATCH_INTEREST_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value, option.label)}
          className="flex items-center gap-2 rounded-pill py-1.5 ps-1.5 pe-4 text-[13.5px] font-medium text-ink transition active:scale-95"
          style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary text-base">
            {option.emoji}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
