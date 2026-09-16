"use client";

import { useMemo } from "react";
import { ChipGroup } from "@/components/ui";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { HomeMapPlace } from "@/screens/home/HomeMap";

/** לפחות תו עברי אחד - מסנן החוצה ערכי subcategory שנוצרו/נשמרו
 *  בשפה אחרת (בקשה מפורשת - "רק קטגוריות בעברית! לא שום דבר בשפה
 *  אחרת"). */
function isHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value);
}

interface FilterModalProps {
  onClose: () => void;
  /** כל המקומות מ-tripadd (לא מסונן) - ממנו נגזרות תתי-הקטגוריה
   *  האמיתיות בפועל, לפי הקטגוריות שנבחרו. לא שאילתה נפרדת לשרת. */
  allPins: HomeMapPlace[];
  selectedCategories: string[];
  selectedSubcategories: string[];
  minRating: number;
  onChangeCategories: (ids: string[]) => void;
  onChangeSubcategories: (values: string[]) => void;
  onChangeMinRating: (value: number) => void;
}

/**
 * *** ממשק סינון על נתוני TripAdd בלבד (בקשה מפורשת - "הנתונים כאן
 * מנותקים מהנתונים הישנים"). *** תיקון (בקשה מפורשת - "התת-קטגוריה
 * צריכה להיפתח רק אחרי שלוחצים על הקטגוריה הראשית"): קטע תתי-
 * הקטגוריה מוצג *רק* אם נבחרה לפחות קטגוריה אחת - לא תמיד גלוי.
 * *** "אנשים" הוסר בינתיים - אין עדיין מקור נתונים אמיתי לזה ב-
 * TripAdd (הרעיון של פרופיל Trippy כ"משפיען ראשי" צוין להמשך, לא
 * מיושם כאן).
 */
export function FilterModal({
  onClose,
  allPins,
  selectedCategories,
  selectedSubcategories,
  minRating,
  onChangeCategories,
  onChangeSubcategories,
  onChangeMinRating,
}: FilterModalProps) {
  const categoryOptions = HOME_QUICK_CATEGORIES.map((c) => ({
    value: c.id,
    label: HOME_QUICK_CATEGORY_LABELS[c.id],
    imageSrc: c.imageSrc,
  }));

  const subcategoryOptions = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    const relevant = allPins.filter((p) => p.category && selectedCategories.includes(p.category));
    const unique = Array.from(new Set(relevant.map((p) => p.subcategory).filter((s): s is string => typeof s === "string" && isHebrew(s))));
    return unique.sort((a, b) => a.localeCompare(b, "he"));
  }, [allPins, selectedCategories]);

  const activeCount = selectedCategories.length + selectedSubcategories.length + (minRating > 0 ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft" style={{ borderRadius: 22 }}>
        <div className="flex shrink-0 items-center justify-between border-b border-ink-secondary/10 px-4 py-3">
          <h2 className="text-[16px] font-bold text-ink">סינון</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-secondary text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <label className="mb-2 block text-[12.5px] font-semibold text-ink-secondary">קטגוריות</label>
          <ChipGroup options={categoryOptions} selected={selectedCategories} onChange={onChangeCategories} />

          {/* *** תיקון (בקשה מפורשת, פעמיים - "לא נפתח קטגוריית משנה"):
              מוצג *אך ורק* אחרי שנבחרה קטגוריה ראשית אחת לפחות. */}
          {selectedCategories.length > 0 && (
            <>
              <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">תת-קטגוריה</label>
              {subcategoryOptions.length > 0 ? (
                <ChipGroup
                  options={subcategoryOptions.map((s) => ({ value: s, label: s }))}
                  selected={selectedSubcategories}
                  onChange={onChangeSubcategories}
                />
              ) : (
                <p className="text-[12px] text-ink-secondary">אין עדיין תת-קטגוריה זמינה בקטגוריה שנבחרה.</p>
              )}
            </>
          )}

          <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">דירוג מינימלי</label>
          <div className="flex gap-2">
            {[0, 3, 4, 4.5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeMinRating(minRating === r ? 0 : r)}
                className={`rounded-pill px-3.5 py-2 text-[13px] font-medium transition ${
                  minRating === r ? "text-white" : "bg-white text-ink"
                }`}
                style={
                  minRating === r
                    ? { background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }
                    : { boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }
                }
              >
                {r === 0 ? "הכל" : `${r}+ ⭐`}
              </button>
            ))}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangeCategories([]);
                onChangeSubcategories([]);
                onChangeMinRating(0);
              }}
              className="mt-5 w-full rounded-pill border border-ink-secondary/20 py-2.5 text-[13px] font-semibold text-ink-secondary"
            >
              נקה הכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
