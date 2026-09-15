"use client";

import { useMemo, useRef, useState } from "react";
import { Chip } from "@/components/ui";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import { TRIPADD_SUBCATEGORIES } from "@/constants/tripAddSubcategories";
import { INTEREST_SUBCATEGORY_GROUPS } from "@/constants/interestSubcategoryGroups";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";
import { useAuth } from "@/hooks/useAuth";

interface FilterModalProps {
  onClose: () => void;
  selectedCategories: HomeQuickCategoryId[];
  selectedSubcategories: string[];
  minRating: number;
  onChangeCategories: (ids: HomeQuickCategoryId[]) => void;
  onChangeSubcategories: (values: string[]) => void;
  onChangeMinRating: (value: number) => void;
}

/**
 * *** עיצוב מחדש (בקשה מפורשת - הפילטרים הישנים "לא רלוונטי"):
 * שורה אחת עם 6 סוגי הטיול (בלי גלילה - כולם נראים ביחד, grid של 6
 * עמודות), ואז - ברגע שנבחר סוג אחד לפחות - שדה חיפוש עם השלמה
 * עצמית (autocomplete) על כל הטקסונומיה של הסוג שנבחר: קטגוריות-
 * המשנה (TRIPADD_SUBCATEGORIES) ותתי-הקטגוריות (התגיות) שבתוכן.
 *
 * לפני הקלדה - השדה כבר מציג רשימה דפדפת מלאה (כל קבוצה + כל
 * התגיות שלה), בדיוק לפי הבקשה "נפתח שורת חיפוש עם כל קטגוריות
 * המשנה - ואז תתי הקטגוריות". תוך כדי הקלדה הרשימה מצטמצמת לפי
 * התאמת טקסט (בשם הקבוצה או בשם התגית עצמה) - "השלמה עצמית של כל
 * האפשרויות שלנו". לחיצה על תגית מוסיפה/מסירה אותה מהפילטר בפועל
 * (selectedSubcategories) - זה הערך היחיד שבאמת מסנן פינים על המפה.
 */
export function FilterModal({
  onClose,
  selectedCategories,
  selectedSubcategories,
  minRating,
  onChangeCategories,
  onChangeSubcategories,
  onChangeMinRating,
}: FilterModalProps) {
  const { preferences } = useAuth();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  function toggleCategory(id: HomeQuickCategoryId) {
    onChangeCategories(
      selectedCategories.includes(id) ? selectedCategories.filter((c) => c !== id) : [...selectedCategories, id]
    );
  }

  // מפתחות "קטגוריה::קבוצה" שרלוונטיים לתחומי-העניין שנבחרו בפרופיל -
  // אותה לוגיקה בדיוק כמו קודם (ר' interestSubcategoryGroups.ts).
  const personalizedGroupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const interest of preferences?.interests ?? []) {
      for (const { category, group } of INTEREST_SUBCATEGORY_GROUPS[interest] ?? []) {
        keys.add(`${category}::${group}`);
      }
    }
    return keys;
  }, [preferences]);

  // כל קבוצות-המשנה של כל הקטגוריות שנבחרו, מהטקסונומיה הקבועה -
  // המותאמות-אישית קודם, בדיוק כמו קודם.
  const groups = useMemo(() => {
    const list = selectedCategories.flatMap((categoryId) =>
      (TRIPADD_SUBCATEGORIES[categoryId as TripAddCategory] ?? []).map((g) => ({
        group: g.group,
        tags: g.tags,
        category: categoryId,
        key: `${categoryId}::${g.group}`,
        personalized: personalizedGroupKeys.has(`${categoryId}::${g.group}`),
      }))
    );
    return [...list].sort((a, b) => Number(b.personalized) - Number(a.personalized));
  }, [selectedCategories, personalizedGroupKeys]);

  // תוצאות החיפוש בפועל: בלי טקסט - כל הקבוצות עם כל התגיות (רשימה
  // דפדפת מלאה). עם טקסט - נשארות רק קבוצות עם התאמה (בשם הקבוצה
  // עצמה, או בשם אחת מהתגיות שבתוכה) - ובתוך קבוצה שהתאמה שלה הגיעה
  // מהתגית, מוצגות רק התגיות התואמות (לא כל הקבוצה).
  const filteredGroups = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    return groups
      .map((g) => {
        const groupNameMatches = g.group.includes(q);
        const tags = groupNameMatches ? g.tags : g.tags.filter((tag) => tag.includes(q));
        return { ...g, tags };
      })
      .filter((g) => g.tags.length > 0);
  }, [groups, query]);

  function selectTag(tag: string) {
    if (!selectedSubcategories.includes(tag)) {
      onChangeSubcategories([...selectedSubcategories, tag]);
    }
    setQuery("");
    searchInputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChangeSubcategories(selectedSubcategories.filter((t) => t !== tag));
  }

  const activeCount = selectedCategories.length + selectedSubcategories.length + (minRating > 0 ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
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
          <label className="mb-2 block text-[12.5px] font-semibold text-ink-secondary">סוג הטיול</label>
          {/* שורה אחת, 6 העמודות - כל הסוגים נראים ביחד, בלי גלילה. */}
          <div className="grid grid-cols-6 gap-1">
            {HOME_QUICK_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-1 pt-1"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-soft transition-shadow"
                    style={
                      isSelected
                        ? { boxShadow: `0 0 0 2.5px var(${category.colorVar}), 0 3px 8px rgba(16,24,40,0.18)` }
                        : undefined
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={category.imageSrc}
                      alt={HOME_QUICK_CATEGORY_LABELS[category.id]}
                      className="h-full w-full scale-125 object-cover"
                    />
                  </span>
                  <span className="w-full text-center text-[9.5px] font-medium leading-tight text-ink">
                    {HOME_QUICK_CATEGORY_LABELS[category.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* *** תיקון (בקשה מפורשת - "נפתח שורת חיפוש רק אחרי שבוחרים
              סוג טיול"): מוצג רק אחרי שנבחרה קטגוריה אחת לפחות. */}
          {selectedCategories.length > 0 && (
            <>
              <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">
               קטגוריות נוספות
              </label>

              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="הקלד לחיפוש - למשל 'סושי' או 'ספא'..."
                className="w-full rounded-pill border border-ink-secondary/15 bg-bg-secondary px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-transparent focus:outline-none focus:ring-2"
                style={{ boxShadow: "none" }}
              />

              {selectedSubcategories.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedSubcategories.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-medium text-white"
                      style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                    >
                      {tag}
                      <span aria-hidden className="text-[13px] leading-none">×</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-3">
                {filteredGroups.length === 0 && (
                  <p className="py-3 text-center text-[12px] text-ink-secondary">לא נמצאו תוצאות תואמות</p>
                )}
                {filteredGroups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
                      {g.group}
                      {g.personalized && (
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                        >
                          מותאם לך
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.tags.map((tag) => (
                        <Chip key={tag} selected={selectedSubcategories.includes(tag)} onClick={() => (selectedSubcategories.includes(tag) ? removeTag(tag) : selectTag(tag))} size="sm">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
                setQuery("");
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
