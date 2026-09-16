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
 * עצמית (autocomplete) על כל הטקסונומיה של הסוג שנבחר.
 *
 * *** תיקון (חוסר-התאמת טיפוסים): TRIPADD_SUBCATEGORIES היא רשימה
 * שטוחה של תגיות (string[]) לכל קטגוריה - לא קבוצות (group+tags).
 * הלוגיקה כאן הותאמה לעבוד ישירות עם תגיות בודדות. ה-personalization
 * (INTEREST_SUBCATEGORY_GROUPS) ממשיך לעבוד רק עבור מקרים שבהם שם
 * ה"group" הממופה תואם בדיוק לאחת התגיות בפועל.
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

  // מפתחות "קטגוריה::תגית" שרלוונטיים לתחומי-העניין שנבחרו בפרופיל.
  const personalizedTagKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const interest of preferences?.interests ?? []) {
      for (const { category, group } of INTEREST_SUBCATEGORY_GROUPS[interest] ?? []) {
        keys.add(`${category}::${group}`);
      }
    }
    return keys;
  }, [preferences]);

  // כל התגיות של כל הקטגוריות שנבחרו, מהטקסונומיה הקבועה (רשימה
  // שטוחה) - המותאמות-אישית קודם.
  const tags = useMemo(() => {
    const list = selectedCategories.flatMap((categoryId) =>
      (TRIPADD_SUBCATEGORIES[categoryId as TripAddCategory] ?? []).map((tag) => ({
        tag,
        category: categoryId,
        key: `${categoryId}::${tag}`,
        personalized: personalizedTagKeys.has(`${categoryId}::${tag}`),
      }))
    );
    return [...list].sort((a, b) => Number(b.personalized) - Number(a.personalized));
  }, [selectedCategories, personalizedTagKeys]);

  // תוצאות החיפוש בפועל: בלי טקסט - כל התגיות. עם טקסט - רק תגיות
  // שהשם שלהן תואם את החיפוש.
  const filteredTags = useMemo(() => {
    const q = query.trim();
    if (!q) return tags;
    return tags.filter((t) => t.tag.includes(q));
  }, [tags, query]);

  const personalizedResults = useMemo(() => filteredTags.filter((t) => t.personalized), [filteredTags]);
  const otherResults = useMemo(() => filteredTags.filter((t) => !t.personalized), [filteredTags]);

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

          {selectedCategories.length > 0 && (
            <>
              <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">
                תת-קטגוריה
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
                {filteredTags.length === 0 && (
                  <p className="py-3 text-center text-[12px] text-ink-secondary">לא נמצאו תוצאות תואמות</p>
                )}

                {personalizedResults.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
                      מותאם לך
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {personalizedResults.map((t) => (
                        <Chip
                          key={t.key}
                          selected={selectedSubcategories.includes(t.tag)}
                          onClick={() => (selectedSubcategories.includes(t.tag) ? removeTag(t.tag) : selectTag(t.tag))}
                          size="sm"
                        >
                          {t.tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {otherResults.length > 0 && (
                  <div>
                    {personalizedResults.length > 0 && (
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
                        עוד אפשרויות
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {otherResults.map((t) => (
                        <Chip
                          key={t.key}
                          selected={selectedSubcategories.includes(t.tag)}
                          onClick={() => (selectedSubcategories.includes(t.tag) ? removeTag(t.tag) : selectTag(t.tag))}
                          size="sm"
                        >
                          {t.tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
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
