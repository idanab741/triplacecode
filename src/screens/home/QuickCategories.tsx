import Link from "next/link";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";

const ICONS: Record<QuickCategoryId, React.ReactNode> = {
  restaurants_cafes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M6 2v7a2 2 0 0 0 2 2v11M6 2v7M9 2v7M15 2c-1.5 2-1.5 6 0 8v11" />
    </svg>
  ),
  romantic_date: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9Z" />
    </svg>
  ),
  weekend: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  nature_trip: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="m3 20 6-10 4 6 3-5 5 9Z" />
    </svg>
  ),
  day_trip: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  ),
};

/** קטגוריות מהירות בגלילה אופקית. */
export function QuickCategories() {
  return (
    <div className="flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
      {QUICK_CATEGORIES.map((category) => (
        <Link
          key={category.id}
          href="/search"
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full shadow-soft"
            style={{ background: `var(${category.colorVar})` }}
          >
            {ICONS[category.id]}
          </span>
          <span className="text-xs font-medium text-ink">
            {QUICK_CATEGORY_LABELS[category.id]}
          </span>
        </Link>
      ))}
    </div>
  );
}
