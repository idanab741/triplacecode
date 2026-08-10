"use client";

import { TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";

interface CategoryPickerProps {
  onSelect: (categoryValue: string, categoryLabel: string) => void;
}

/** שלב 2 - בחירת אחת מ-4 הקטגוריות הראשיות (מסעדות/חיי לילה/טבע/אטרקציות).
 *  לפני התיקון הזה הוצגה כאן רשימה שטוחה של 19 תת-קטגוריות - זה עבר
 *  לפילטרים בתוך ההחלקות (FiltersSheet), כדי שהבחירה הראשונית תהיה
 *  פשוטה, ושהתוצאות תמיד יהיו מהקטגוריה הנכונה בלבד (לא עוד מלונות
 *  שמתערבבים במסעדות וכו'). */
export function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TRIPMATCH_CATEGORY_BUCKETS.map((bucket) => (
        <button
          key={bucket.value}
          type="button"
          onClick={() => onSelect(bucket.value, bucket.label)}
          className="flex flex-col items-center gap-2 rounded-card py-6 px-3 text-center transition active:scale-95"
          style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary text-2xl">
            {bucket.emoji}
          </span>
          <span className="text-[14px] font-semibold text-ink">{bucket.label}</span>
        </button>
      ))}
    </div>
  );
}
