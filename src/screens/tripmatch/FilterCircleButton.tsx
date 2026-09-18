"use client";

interface FilterCircleButtonProps {
  onClick: () => void;
  activeFilterCount: number;
}

/**
 * כפתור פילטרים בעיצוב זהה לעיגולי "סוגי הטיול" (HomeQuickCategories) -
 * עיגול 44px + תווית מתחתיו, באותו רוחב (58px) - כדי שיישב *בתוך אותה
 * שורה בדיוק*, כפריט הראשון מימין (בקשה מפורשת - "השורה של הפילטרים
 * צריכה להיות בשורה של הסוגים - הראשונה מימין"). מועבר ל-
 * HomeQuickCategories דרך ה-prop `leading`.
 */
export function FilterCircleButton({ onClick, activeFilterCount }: FilterCircleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="פילטרים"
      className="flex w-[58px] shrink-0 flex-col items-center gap-1"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-start)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {activeFilterCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </span>
      <span className="w-full text-center text-[10.5px] font-medium leading-tight text-ink">פילטרים</span>
    </button>
  );
}
