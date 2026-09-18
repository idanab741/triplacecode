"use client";

import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";

interface Props {
  categoryIds: QuickCategoryId[];
  onSelect: (id: QuickCategoryId) => void;
}

/** כפתורי בחירת קטגוריית טיול עם אייקון, למסך הפתיחה של טריפי AI. */
export function CategoryOptions({ categoryIds, onSelect }: Props) {
  const categories = QUICK_CATEGORIES.filter((category) => categoryIds.includes(category.id));

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className="flex items-center gap-2 rounded-pill py-1.5 ps-1.5 pe-4 text-[13.5px] font-medium text-ink transition active:scale-95"
          style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={category.imageSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
          {QUICK_CATEGORY_LABELS[category.id]}
        </button>
      ))}
    </div>
  );
}
