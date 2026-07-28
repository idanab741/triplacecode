"use client";

import { useEffect, useRef, useState } from "react";

interface HotelSuggestion {
  placeId: string;
  description: string;
}

interface HotelAutocompleteProps {
  name: string;
  address: string;
  onChange: (name: string, address: string) => void;
}

/** שדה שם מלון עם השלמה אוטומטית אמיתית (Google Places) - בבחירת הצעה,
 *  ממלא גם את הכתובת אוטומטית, בלי שהמשתמש יצטרך להקליד אותה. */
export function HotelAutocomplete({ name, address, onChange }: HotelAutocompleteProps) {
  const [query, setQuery] = useState(name);
  const [options, setOptions] = useState<HotelSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(name);
  }, [name]);

  useEffect(() => {
    if (query.trim().length < 2 || query === name) {
      setOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/hotels?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data) => setOptions(data.hotels ?? []))
        .catch(() => setOptions([]));
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function selectHotel(suggestion: HotelSuggestion) {
    setLoading(true);
    setOptions([]);
    try {
      const response = await fetch(`/api/places/hotels?placeId=${encodeURIComponent(suggestion.placeId)}`);
      const data = await response.json();
      if (data.name) {
        setQuery(data.name);
        onChange(data.name, data.address ?? "");
      }
    } catch {
      // אם השליפה נכשלת - לפחות שומרים את התיאור הגולמי כשם
      setQuery(suggestion.description);
      onChange(suggestion.description, address);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value, address);
        }}
        placeholder="הקלידו את שם המלון..."
        className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      {loading && <p className="mt-1 text-xs text-ink-secondary">טוען פרטי מלון...</p>}
      {options.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
          {options.map((option) => (
            <button
              key={option.placeId}
              type="button"
              onClick={() => selectHotel(option)}
              className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
            >
              {option.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
