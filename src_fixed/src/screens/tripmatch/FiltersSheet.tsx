"use client";

import { useMemo, type ReactNode } from "react";
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
  /** כמות המקומות שמתאימים לפילטרים הנוכחיים (visibleCandidates.length
   *  מהעמוד) - מוצגת על כפתור "הצג N מקומות". לא מועבר = "הצג תוצאות". */
  resultCount?: number;
}

const PRICE_LABELS = ["חינם", "₪", "₪₪", "₪₪₪"];
const RATING_OPTIONS = [3, 4, 4.5];

/** Bottom Sheet פילטרים - האפשרויות הקטגוריאליות (בתחתית) לא מקודדות
 *  מראש לפי סוג מסלול; הן נגזרות בזמן אמת מהתגיות שבאמת קיימות על
 *  המועמדים שכבר נטענו, כך שהפילטר תמיד רלוונטי ואמיתי לתוצאות.
 *  *** תיקון: לפני זה הרשימה מוינה רק לפי שכיחות בין המועמדים, בלי
 *  שום קשר להעדפות שהמשתמש כבר ענה עליהן באונבורדינג - עכשיו תגיות
 *  שמופיעות גם בפרופיל ההעדפות שלו קופצות ראשונות ומסומנות ⭐. */
export function FiltersSheet({ candidates, filters, onChange, onClose, preferredTags = [], resultCount }: FiltersSheetProps) {
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

  const activeCount = countActiveFilters(filters);
  const hasPreferredChips = availableTags.some((t) => preferredTags.includes(t));

  const toggleRows = [
    { key: "kosherOnly" as const, label: "כשר בלבד", hint: "רק מקומות כשרים", icon: <KosherIcon /> },
    { key: "accessibleOnly" as const, label: "נגיש בלבד", hint: "רק מקומות נגישים", icon: <AccessibleIcon /> },
    { key: "kidFriendlyOnly" as const, label: "מתאים לילדים", hint: "מתאים למשפחות עם ילדים", icon: <KidsIcon /> },
  ];

  const resultsLabel =
    resultCount == null
      ? "הצג תוצאות"
      : resultCount === 0
        ? "אין מקומות מתאימים"
        : resultCount === 1
          ? "הצג מקום אחד"
          : `הצג ${resultCount} מקומות`;

  return (
    <BottomSheet
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            disabled={activeCount === 0}
            className="rounded-2xl bg-bg-secondary px-6 py-3.5 text-[14px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-40"
          >
            איפוס
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 rounded-2xl py-3.5 text-[15px] font-bold text-white shadow-[0_10px_22px_-10px_rgba(27,111,232,0.8)] transition active:scale-[0.98] ${
              resultCount === 0 ? "opacity-70" : ""
            }`}
            style={{ background: BRAND_GRADIENT }}
          >
            {resultsLabel}
          </button>
        </div>
      }
    >
      {/* כותרת: אייקון מותג + שם + סטטוס, וכפתור "נקה הכל" כשיש פילטרים פעילים */}
      <div className="flex items-center gap-3 px-5 pb-1 pt-1">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_8px_18px_-8px_rgba(27,111,232,0.7)]"
          style={{ background: BRAND_GRADIENT }}
        >
          {/* *** תיקון (בקשה מפורשת - "לשנות את האייקון לזה שמופיע בעמוד הבית"): אותו אייקון בדיוק כמו כפתור
              הפילטרים בעמוד הבית (FilterCircleButton) - שלוש קווים אופקיים בגדלים יורדים. */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-extrabold leading-tight text-ink">סינון</h2>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            {activeCount > 0 ? `${activeCount} סינונים פעילים` : "התאימו את המקומות שמוצגים לכם"}
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ background: TINT, color: BRAND_TEXT }}
          >
            נקה הכל
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 px-5 pb-3 pt-5">
        <section>
          <SectionHeader icon={<PriceIcon />} title="מחיר מקסימלי" hint={filters.maxPriceLevel != null ? "עד הרמה שנבחרה" : "בלי הגבלה"} />
          <Segmented
            value={filters.maxPriceLevel}
            onSelect={(level) => onChange({ ...filters, maxPriceLevel: filters.maxPriceLevel === level ? null : level })}
            options={PRICE_LABELS.map((label, level) => ({
              value: level,
              label: <span className="tracking-[0.08em]">{label}</span>,
            }))}
          />
        </section>

        <section>
          <SectionHeader icon={<StarIcon size={17} fill="currentColor" />} title="דירוג מינימלי" hint={filters.minRating != null ? `${filters.minRating} ומעלה` : "כל הדירוגים"} />
          <Segmented
            value={filters.minRating}
            onSelect={(rating) => onChange({ ...filters, minRating: filters.minRating === rating ? null : rating })}
            options={RATING_OPTIONS.map((rating) => ({
              value: rating,
              label: (
                <>
                  <StarIcon size={13} fill={filters.minRating === rating ? "#fff" : "#FFB020"} />
                  <span>{rating}+</span>
                </>
              ),
            }))}
          />
        </section>

        <section>
          <SectionHeader icon={<GridIcon />} title="התאמות מיוחדות" hint="רק מה שחשוב לכם" />
          <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink-secondary/10">
            {toggleRows.map(({ key, label, hint, icon }, i) => {
              const on = filters[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => onChange({ ...filters, [key]: !filters[key] })}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-start transition active:bg-bg-secondary ${
                    i > 0 ? "border-t border-ink-secondary/10" : ""
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition"
                    style={on ? { background: BRAND_GRADIENT, color: "#fff" } : { background: TINT, color: BRAND_TEXT }}
                  >
                    {icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink">{label}</span>
                    <span className="block text-[11.5px] text-ink-secondary">{hint}</span>
                  </span>
                  <SwitchTrack on={on} />
                </button>
              );
            })}
          </div>
        </section>

        {availableTags.length > 0 && (
          <section>
            <SectionHeader
              icon={<GridIcon />}
              title="תת-קטגוריה"
              hint={
                filters.tags.length > 0
                  ? `${filters.tags.length} נבחרו`
                  : hasPreferredChips
                    ? "הכוכב מסמן התאמה להעדפות שלכם"
                    : "בחירה מדויקת יותר"
              }
            />
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const active = filters.tags.includes(tag);
                const preferred = preferredTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition active:scale-95 ${
                      active ? "text-white shadow-[0_6px_14px_-6px_rgba(27,111,232,0.75)]" : "bg-white text-ink ring-1 ring-ink-secondary/15"
                    }`}
                    style={active ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {preferred && <StarIcon size={11} fill={active ? "#fff" : "#FFB020"} />}
                    {getCategoryLabel(tag)}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}

/* ---------------------------- רכיבי עזר ויזואליים ---------------------------- */

const BRAND_GRADIENT = "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))";
const BRAND_TEXT = "var(--color-primary-end)";
const TINT = "#eaf3ff";

function SectionHeader({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: TINT, color: BRAND_TEXT }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold leading-tight text-ink">{title}</p>
        {hint && <p className="mt-0.5 text-[11.5px] text-ink-secondary">{hint}</p>}
      </div>
    </div>
  );
}

/** בורר מקטעים (segmented control): מסילה אפורה עדינה, והבחירה הפעילה
 *  מודגשת בגרדיאנט המותג. לחיצה חוזרת על הפעיל מבטלת (מטופל אצל הקורא). */
function Segmented({
  options,
  value,
  onSelect,
}: {
  options: { value: number; label: ReactNode }[];
  value: number | null;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-bg-secondary p-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(option.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-[13.5px] font-semibold transition active:scale-[0.97] ${
              active ? "text-white shadow-[0_6px_14px_-6px_rgba(27,111,232,0.8)]" : "text-ink"
            }`}
            style={active ? { background: BRAND_GRADIENT } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** מתג בסגנון native. המיקום לפי inset-inline-start - תקין אוטומטית תחת
 *  dir="rtl" (כבוי = ימין, דלוק = שמאל), עם אנימציה חלקה. */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? BRAND_GRADIENT : "rgba(138,143,163,0.3)" }}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.25)] transition-all"
        style={{ insetInlineStart: on ? 21 : 3 }}
      />
    </span>
  );
}

function StarIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
      <path d="M12 2l2.9 6.9L22 9.6l-5.5 5 1.6 7.4L12 18.6 5.9 22l1.6-7.4L2 9.6l7.1-.7L12 2Z" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

function KosherIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 20 17H4L12 3Z" />
      <path d="M12 21 4 7h16L12 21Z" />
    </svg>
  );
}

function AccessibleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z" />
    </svg>
  );
}

function KidsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2.5 4 2.5S16 14 16 14" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}
