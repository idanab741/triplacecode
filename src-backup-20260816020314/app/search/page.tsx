"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Chip, Screen, Switch } from "@/components/ui";
import { SEARCH_CATEGORY_CHIPS, type SearchCategoryChip } from "@/constants/searchCategories";
import type { SearchFilters } from "@/services/places/searchService";
import { SearchResults } from "@/screens/search/SearchResults";

const RATING_OPTIONS = [
  { label: "הכל", value: null },
  { label: "3+", value: 3 },
  { label: "3.5+", value: 3.5 },
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

const PRICE_OPTIONS = [
  { label: "הכל", value: null },
  { label: "₪", value: 1 },
  { label: "₪₪", value: 2 },
  { label: "₪₪₪", value: 3 },
  { label: "₪₪₪₪", value: 4 },
];

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const { preferences, preferencesLoading } = useAuth();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [activeCategories, setActiveCategories] = useState<string[]>(() => {
    const raw = searchParams.get("category");
    return raw ? raw.split(",") : [];
  });
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxPriceLevel, setMaxPriceLevel] = useState<number | null>(null);

  const [kosherFilter, setKosherFilter] = useState(false);
  const [accessibleFilter, setAccessibleFilter] = useState(false);
  const [kosherFromPrefs, setKosherFromPrefs] = useState(false);
  const [accessibleFromPrefs, setAccessibleFromPrefs] = useState(false);
  const [prefsApplied, setPrefsApplied] = useState(false);

  if (!preferencesLoading && !prefsApplied) {
    setPrefsApplied(true);
    if (preferences?.kosher) {
      setKosherFilter(true);
      setKosherFromPrefs(true);
    }
    if (preferences?.accessibility) {
      setAccessibleFilter(true);
      setAccessibleFromPrefs(true);
    }
  }

  const debouncedQuery = useDebouncedValue(query, 350);

  const filters: SearchFilters = {
    query: debouncedQuery,
    categories: activeCategories,
    minRating,
    maxPriceLevel,
    kosher: kosherFilter,
    accessible: accessibleFilter,
  };
  const filtersKey = JSON.stringify(filters);

  function isChipActive(chip: SearchCategoryChip) {
    if (chip.id === "all") return activeCategories.length === 0;
    return (chip.categories ?? []).some((c) => activeCategories.includes(c));
  }

  function toggleChip(chip: SearchCategoryChip) {
    if (chip.id === "all") {
      setActiveCategories([]);
      return;
    }
    const chipCategories = chip.categories ?? [];
    const allActive = chipCategories.every((c) => activeCategories.includes(c));
    if (allActive) {
      setActiveCategories((prev) => prev.filter((c) => !chipCategories.includes(c)));
    } else {
      setActiveCategories((prev) => Array.from(new Set([...prev, ...chipCategories])));
    }
  }

  function handleClearFilters() {
    setQuery("");
    setActiveCategories([]);
    setMinRating(null);
    setMaxPriceLevel(null);
    setKosherFilter(false);
    setAccessibleFilter(false);
  }

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-4">
        <div className="relative px-6">
          <span className="pointer-events-none absolute inset-y-0 start-9 flex items-center text-ink-secondary">
            <SearchIcon />
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="מה תרצו לעשות היום?"
            className="w-full rounded-pill border border-ink-secondary/20 bg-bg py-3 ps-11 pe-10 text-sm text-ink shadow-soft placeholder:text-ink-secondary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="נקה חיפוש"
              className="absolute inset-y-0 end-9 flex items-center text-ink-secondary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {SEARCH_CATEGORY_CHIPS.map((chip) => (
            <Chip key={chip.id} selected={isChipActive(chip)} onClick={() => toggleChip(chip)}>
              {chip.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-6">
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <span className="shrink-0 text-xs font-medium text-ink-secondary">דירוג:</span>
            {RATING_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                selected={minRating === option.value}
                onClick={() => setMinRating(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <span className="shrink-0 text-xs font-medium text-ink-secondary">מחיר:</span>
            {PRICE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                selected={maxPriceLevel === option.value}
                onClick={() => setMaxPriceLevel(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-card bg-bg-secondary p-3">
            <div className="flex items-center justify-between gap-2">
              <Switch checked={kosherFilter} onChange={setKosherFilter} label="כשר" />
              {kosherFromPrefs && kosherFilter && (
                <span className="text-xs text-accent">לפי ההעדפות שלך</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Switch checked={accessibleFilter} onChange={setAccessibleFilter} label="נגיש" />
              {accessibleFromPrefs && accessibleFilter && (
                <span className="text-xs text-accent">לפי ההעדפות שלך</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-6">
          <SearchResults key={filtersKey} filters={filters} onClearFilters={handleClearFilters} />
        </div>
      </div>
    </Screen>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <Screen withBottomNavSpacing={false}>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
