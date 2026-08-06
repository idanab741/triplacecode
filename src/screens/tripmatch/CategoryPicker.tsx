"use client";

import { TRIPMATCH_INTEREST_OPTIONS } from "@/locales/he/tripBuilder";

interface CategoryPickerProps {
  onSelect: (categoryValue: string, categoryLabel: string) => void;
}

/** שלב 2 - בחירת סוג מסלול יחיד (לא בחירה מרובה). ברגע שנבחרת קטגוריה
 *  עוברים ישר להחלקות - אין כפתור "המשך" נפרד. */
export function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TRIPMATCH_INTEREST_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value, option.label)}
          className="flex flex-col items-start gap-2 rounded-card bg-white p-4 text-start shadow-soft transition active:scale-[0.97]"
        >
          <span className="text-2xl">{option.emoji}</span>
          <span className="text-[13.5px] font-semibold leading-snug text-ink">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
