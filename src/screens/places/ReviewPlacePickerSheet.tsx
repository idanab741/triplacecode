"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { searchPlaces, type PlaceSearchResult } from "@/services/places/searchService";

interface ReviewPlacePickerSheetProps {
  onClose: () => void;
  onSelectPlace: (place: PlaceSearchResult) => void;
  onSuggestNewPlace: () => void;
}

/** שלב ראשון של "ביקורת": בחירת מקום קיים מהמאגר. אם לא נמצא - פותח
 *  את SuggestPlaceSheet (Bottom Sheet, לא ניווט לעמוד - בקשה מפורשת). */
export function ReviewPlacePickerSheet({ onClose, onSelectPlace, onSuggestNewPlace }: ReviewPlacePickerSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function runSearch(term: string) {
    setQuery(term);
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const found = await searchPlaces(
        { query: term.trim(), categories: [], minRating: null, maxPriceLevel: null, kosher: false, accessible: false },
        0,
        15
      );
      setResults(found);
    } finally {
      setSearching(false);
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto px-5 pb-2">
        <h2 className="mb-4 text-[17px] font-bold text-ink">על איזה מקום תרצה לכתוב ביקורת?</h2>

        <input
          autoFocus
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="חפש מקום..."
          className="mb-3 w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
        />

        {searching && <p className="py-4 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}

        {results?.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => onSelectPlace(place)}
            className="flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-start hover:bg-bg-secondary"
          >
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {place.image_urls?.[0] && <img src={place.image_urls[0]} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-ink">{place.name}</span>
              {place.city && <span className="text-[12px] text-ink-secondary">{place.city}</span>}
            </span>
          </button>
        ))}

        {results !== null && !searching && results.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-ink-secondary">לא נמצאו מקומות תואמים</p>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            onSuggestNewPlace();
          }}
          className="mt-3 w-full rounded-pill border py-2.5 text-[13px] font-bold"
          style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
        >
          לא מוצא את המקום? הצע מקום חדש
        </button>
      </div>
    </BottomSheet>
  );
}
