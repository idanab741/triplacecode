"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface DestinationSuggestion {
  value: string;
  label: string;
  type: "city" | "country";
}

interface SearchBarLinkProps {
  /** תיקון (Home - כניסה ל-TripMatch): כש-true, ה-autocomplete מביא
   *  יעדים קיימים (ערים/מדינות - אותו /api/places/cities שכבר משמש את
   *  TripMatch עצמו, לא search engine חדש) במקום חיפוש מקומות כללי,
   *  ואף פעם לא מנווט בעצמו. "השלמת" יעד (לא כל הקשה!) - קליק על הצעה,
   *  או Enter כשהטקסט תואם הצעה בדיוק - מדווחת כלפי מעלה דרך
   *  onSelectDestination בלבד. ברירת המחדל false שומרת על ההתנהגות
   *  המקורית (חיפוש מקומות כללי + ניווט ל-/search).
   */
  destinationMode?: boolean;
  /** נקרא רק כשמשתמש בפועל "השלים" יעד קיים - לא נקרא על כל הקשה. */
  onSelectDestination?: (label: string) => void;
}

export function SearchBarLink({ destinationMode = false, onSelectDestination }: SearchBarLinkProps = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<DestinationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPlaceSuggestions([]);
      setDestinationSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (destinationMode) {
        // אותו endpoint בדיוק שבו TripMatch עצמו משתמש לבחירת יעד.
        fetch(`/api/places/cities?q=${encodeURIComponent(query.trim())}`)
          .then((res) => res.json())
          .then((data) => setDestinationSuggestions(data.options ?? []))
          .catch(() => setDestinationSuggestions([]));
      } else {
        fetch(`/api/places/search-autocomplete?q=${encodeURIComponent(query.trim())}`)
          .then((res) => res.json())
          .then((data) => setPlaceSuggestions(data.suggestions ?? []))
          .catch(() => setPlaceSuggestions([]));
      }
    }, destinationMode ? 300 : 450); // תיקון עלויות: הוארך מ-450ms במצב הרגיל - פחות קריאות בתשלום לגוגל בזמן הקלדה
  }, [query, destinationMode]);

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

  function goToPlaceResult(placeId: string) {
    setOpen(false);
    router.push(`/search/result?placeId=${encodeURIComponent(placeId)}`);
  }

  function selectDestination(option: DestinationSuggestion) {
    setOpen(false);
    setQuery(option.label);
    setDestinationSuggestions([]);
    onSelectDestination?.(option.label);
  }

  function handleEnter() {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (destinationMode) {
      // *** תיקון (בקשה מפורשת - "אין לי באפשרויות תל אביב"): השם
      // הרשמי ב-destinations הוא "תל אביב-יפו" (לא "תל אביב") - התאמה
      // מדויקת (exact string match) בין הטקסט שהוקלד להצעה מעולם לא
      // תעבוד לערים כאלה. עכשיו Enter פשוט בוחר את ההצעה הראשונה
      // שכבר נטענה (אותן תוצאות שמוצגות ברשימה) - עדיין רק מתוך יעדים
      // קיימים אמיתיים, לא טקסט חופשי, ועדיין רק בפעולה מפורשת (Enter),
      // לא על כל הקשה.
      const topMatch = destinationSuggestions[0];
      if (topMatch) selectDestination(topMatch);
      return;
    }
    goToSearch(trimmed);
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
            if (e.key === "Enter") handleEnter();
          }}
          placeholder="מה ה־match שלכם היום?"
          className="w-full bg-transparent text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        {/* לוגו TripMatch קטן ומעומעם בצד שמאל של השורה (בקשה מפורשת) -
            filter: grayscale מוריד ממנו את הצבע, opacity מעדן אותו עוד -
            לא לחיץ, רק רמז ויזואלי עדין שהחיפוש הזה קשור ל-TripMatch. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/trip-tripmatch-logo.png"
          alt=""
          aria-hidden="true"
          className="h-6 w-auto shrink-0 object-contain"
          style={{ filter: "grayscale(1)", opacity: 0.35 }}
        />
      </div>

      {!destinationMode && open && placeSuggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-[120px] overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
          {placeSuggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => goToPlaceResult(s.placeId)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-ink-secondary/10 px-4 py-2.5 text-start last:border-none hover:bg-bg-secondary"
            >
              <span className="text-sm font-medium text-ink">{s.mainText}</span>
              {s.secondaryText && <span className="text-xs text-ink-secondary">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}

      {destinationMode && open && destinationSuggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
          {destinationSuggestions.map((option) => (
            <button
              key={`${option.type}-${option.value}`}
              type="button"
              onClick={() => selectDestination(option)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
            >
              <span>{option.label}</span>
              {option.type === "country" && <span className="text-[11px] text-ink-secondary">מדינה שלמה</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
