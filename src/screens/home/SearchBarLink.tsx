"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

/** שורת חיפוש אמיתית עם השלמה אוטומטית חיה מ-Google (אותו דפוס בדיוק
 *  כמו HotelAutocomplete בחו"ל) - במקום קישור סתמי ל-/search. בבחירת
 *  הצעה, או ב-Enter על טקסט חופשי, מנווט ל-/search?q=... שכבר יודע
 *  לחפש במאגר המקומות של האפליקציה. */
export function SearchBarLink() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/search-autocomplete?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }, 300);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToSearch(q: string) {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={containerRef} className="relative mx-6">
      <div className="flex items-center gap-2 rounded-pill border border-ink-secondary/15 bg-bg px-4 py-3 text-sm text-ink shadow-soft">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-secondary">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) goToSearch(query.trim());
          }}
          placeholder="מה תרצו לעשות היום?"
          className="w-full bg-transparent text-ink placeholder:text-ink-secondary focus:outline-none"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => goToSearch(s.mainText)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-ink-secondary/10 px-4 py-2.5 text-start last:border-none hover:bg-bg-secondary"
            >
              <span className="text-sm font-medium text-ink">{s.mainText}</span>
              {s.secondaryText && <span className="text-xs text-ink-secondary">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
