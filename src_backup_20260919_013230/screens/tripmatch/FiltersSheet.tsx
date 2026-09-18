"use client";

import { useMemo } from "react";
import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import { BottomSheet } from "@/components/ui";
import type { CandidatePlace } from "@/services/tripBuilder/types";

export interface TripMatchFilters {
  maxPriceLevel: number | null; // 0-3, null = ללא הגבלה
  minRating: number | null;
  kosherOnly: boolean;
  accessibleOnly: boolean;
  kidFriendlyOnly: boolean;
  tags: string[]; // תגיות נבחרות מתוך tripTypeTags/cuisineTags
}

export const EMPTY_FILTERS: TripMatchFilters = {
  maxPriceLevel: null,
  minRating: null,
  kosherOnly: false,
  accessibleOnly: false,
  kidFriendlyOnly: false,
  tags: [],
};

export function countActiveFilters(filters: TripMatchFilters): number {
  return (
    (filters.maxPriceLevel != null ? 1 : 0) +
    (filters.minRating != null ? 1 : 0) +
    (filters.kosherOnly ? 1 : 0) +
    (filters.accessibleOnly ? 1 : 0) +
    (filters.kidFriendlyOnly ? 1 : 0) +
    filters.tags.length
  );
}

export function applyFilters(candidates: CandidatePlace[], filters: TripMatchFilters): CandidatePlace[] {
  return candidates.filter((c) => {
    if (filters.maxPriceLevel != null && (c.priceLevel ?? 99) > filters.maxPriceLevel) return false;
    if (filters.minRating != null && (c.rating ?? 0) < filters.minRating) return false;
    if (filters.kosherOnly && !c.kosher) return false;
    if (filters.accessibleOnly && !c.accessible) return false;
    if (filters.kidFriendlyOnly && c.suitableChildAges.length === 0) return false;
    if (filters.tags.length > 0) {
      // *** תיקון: לפני זה בדק רק tripTypeTags/cuisineTags (טקסונומיית
      // האונבורדינג) - מקומות שתויגו רק דרך "✨ תקן עם AI" באדמין (שדה
      // tags, טקסונומיה אחרת) פשוט לא היו עוברים אף פילטר, גם אם באמת
      // מתאימים - זו הסיבה שהפילטרים "לא נתנו תוצאות".
      const candidateTags = new Set([...c.tripTypeTags, ...c.cuisineTags, ...(c.tags ?? [])]);
      if (!filters.tags.every((t) => candidateTags.has(t))) return false;
    }
    return true;
  });
}

interface FiltersSheetProps {
  candidates: CandidatePlace[];
  filters: TripMatchFilters;
  onChange: (filters: TripMatchFilters) => void;
  onClose: () => void;
  /** תגיות מהעדפות האונבורדינג (תחומי עניין + סגנון קולינרי) - אלה
   *  מוצגות ראשונות ומסומנות בכוכב, כדי שהמשתמש יראה קודם כל את מה
   *  שכבר סיפר לנו שהוא אוהב. */
  preferredTags?: string[];
}

const PRICE_LABELS = ["חינם", "₪", "₪₪", "₪₪₪"];
const RATING_OPTIONS = [3, 4, 4.5];

/** Bottom Sheet פילטרים - האפשרויות הקטגוריאליות (בתחתית) לא מקודדות
 *  מראש לפי סוג מסלול; הן נגזרות בזמן אמת מהתגיות שבאמת קיימות על
 *  המועמדים שכבר נטענו, כך שהפילטר תמיד רלוונטי ואמיתי לתוצאות.
 *  *** תיקון: לפני זה הרשימה מוינה רק לפי שכיחות בין המועמדים, בלי
 *  שום קשר להעדפות שהמשתמש כבר ענה עליהן באונבורדינג - עכשיו תגיות
 *  שמופיעות גם בפרופיל ההעדפות שלו קופצות ראשונות ומסומנות ⭐. */
export function FiltersSheet({ candidates, filters, onChange, onClose, preferredTags = [] }: FiltersSheetProps) {
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      for (const tag of [...c.tripTypeTags, ...c.cuisineTags, ...(c.tags ?? [])]) {
        if (!hasHebrewLabel(tag)) continue; // "רק בעברית" - לא מציגים תגיות שאין להן תרגום
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const preferredSet = new Set(preferredTags);
    return Array.from(counts.entries())
      .sort((a, b) => {
        const aPreferred = preferredSet.has(a[0]) ? 1 : 0;
        const bPreferred = preferredSet.has(b[0]) ? 1 : 0;
        if (aPreferred !== bPreferred) return bPreferred - aPreferred;
        return b[1] - a[1];
      })
      .slice(0, 20)
      .map(([tag]) => tag);
  }, [candidates, preferredTags]);

  function toggleTag(tag: string) {
    onChange({
      ...filters,
      tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag],
    });
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="p-5">
        <h2 className="text-lg font-bold text-ink">פילטרים</h2>

        <div className="mt-5 flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-secondary">מחיר מקסימלי</p>
            <div className="flex gap-2">
              {PRICE_LABELS.map((label, level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ ...filters, maxPriceLevel: filters.maxPriceLevel === level ? null : level })}
                  className={`flex-1 rounded-pill py-2 text-[13px] font-semibold transition ${
                    filters.maxPriceLevel === level ? "bg-accent text-white" : "bg-bg-secondary text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-secondary">דירוג מינימלי</p>
            <div className="flex gap-2">
              {RATING_OPTIONS.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => onChange({ ...filters, minRating: filters.minRating === rating ? null : rating })}
                  className={`flex-1 rounded-pill py-2 text-[13px] font-semibold transition ${
                    filters.minRating === rating ? "bg-accent text-white" : "bg-bg-secondary text-ink"
                  }`}
                >
                  ⭐ {rating}+
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { key: "kosherOnly" as const, label: "✡️ כשר בלבד" },
              { key: "accessibleOnly" as const, label: "♿ נגיש בלבד" },
              { key: "kidFriendlyOnly" as const, label: "👨‍👩‍👧 מתאים לילדים בלבד" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...filters, [key]: !filters[key] })}
                className="flex items-center justify-between rounded-card bg-white px-4 py-3 shadow-soft"
              >
                <span className="text-[13.5px] font-medium text-ink">{label}</span>
                <span
                  className={`flex h-5 w-9 items-center rounded-pill p-0.5 transition ${filters[key] ? "justify-end bg-accent" : "justify-start bg-bg-secondary"}`}
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow" />
                </span>
              </button>
            ))}
          </div>

          {availableTags.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-secondary">תת-קטגוריה (בחירה מדויקת יותר)</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-pill px-3 py-1.5 text-[12.5px] font-medium transition ${
                      filters.tags.includes(tag) ? "bg-accent text-white" : "bg-bg-secondary text-ink"
                    }`}
                  >
                    {preferredTags.includes(tag) && "⭐ "}
                    {getCategoryLabel(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="flex-1 rounded-pill bg-bg-secondary py-3 text-sm font-semibold text-ink">
            איפוס
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-pill py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            הצג תוצאות
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
