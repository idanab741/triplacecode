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
  /** יעד הטיול (עיר/מדינה) - מטה את תוצאות ההשלמה האוטומטית לאזור הזה,
   *  כדי שלא יחזרו מלונות מכל העולם. */
  destination?: string;
}

/** שדה שם מלון עם השלמה אוטומטית אמיתית (Google Places) - בבחירת הצעה,
 *  ממלא גם את הכתובת אוטומטית, בלי שהמשתמש יצטרך להקליד אותה. */
export function HotelAutocomplete({ name, address, onChange, destination }: HotelAutocompleteProps) {
  const [query, setQuery] = useState(name);
  const [options, setOptions] = useState<HotelSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // דגל "רק נבחר מהרשימה" - כדי לדעת מתי **לא** לחפש שוב (מיד אחרי שהמשתמש
  // בחר הצעה, אין טעם לחפש עוד פעם על השם שהיא בדיוק החזירה). קודם זה
  // נבדק לפי query === name - אבל בגלל שה-onChange למעלה מתעדכן בכל הקלדה,
  // השניים תמיד היו שווים, וזה חסם **כל** חיפוש, בלי יוצא מן הכלל.
  const justSelectedRef = useRef(false);

  useEffect(() => {
    setQuery(name);
  }, [name]);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      setOptions([]);
      setSearchError(null);
      return;
    }
    if (query.trim().length < 3) {
      // תיקון עלויות: 2 היה נמוך מדי - כמו בשאר תיבות ה-autocomplete באפליקציה
      setOptions([]);
      setSearchError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      if (destination) params.set("destination", destination);
      fetch(`/api/places/hotels?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setOptions(data.hotels ?? []);
          // מציגים את השגיאה **בתצוגה עצמה**, לא רק בלוג של השרת - כדי שאפשר
          // יהיה לראות מיד מה בדיוק גוגל מחזיר, בלי צורך בטרמינל בכלל.
          setSearchError(data.googleStatus ? `${data.googleStatus}${data.googleErrorMessage ? ` - ${data.googleErrorMessage}` : ""}` : null);
        })
        .catch(() => {
          setOptions([]);
          setSearchError("שגיאת רשת בחיפוש");
        });
    }, 450); // תיקון עלויות: הוארך מ-300ms - פחות קריאות בתשלום לגוגל בזמן הקלדה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, destination]);

  async function selectHotel(suggestion: HotelSuggestion) {
    setLoading(true);
    setOptions([]);
    justSelectedRef.current = true;
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
      {searchError && (
        <p className="mt-1 text-xs text-danger">שגיאת חיפוש: {searchError}</p>
      )}
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
