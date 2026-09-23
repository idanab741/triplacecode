"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface PlaceSuggestion {
  /** *** שינוי (בקשה מפורשת - "רק ממאגר TRIPADD, לא מגוגל"): מגיע
   *  מ-tripadd_submissions.id עכשיו - לא Google place_id. */
  id: string;
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
  /** *** תוספת (שדרוג ויזואלי - שורת חיפוש לצד כפתור "קרוב אלי"):
   *  ה-mx-6 המקורי הניח תמיד שהרכיב תופס את כל רוחב המסך בעצמו - כדי
   *  לשים אותו בתוך שורה יחד עם כפתור נוסף (flex) צריך לשלוט על זה
   *  מבחוץ. ברירת המחדל שומרת בדיוק על ההתנהגות הקיימת בכל השימושים
   *  הנוכחיים (home/page.tsx הרגיל, StickyHeader.tsx). */
  containerClassName?: string;
  /** "hero" - העיצוב החדש של עמוד הבית על רקע כחול: גובה קבוע 48px, לבן
   *  מלא, בלי מסגרת, אייקון חיפוש בכחול המותג, צל עדין וטבעת פוקוס.
   *  ברירת המחדל "default" שומרת על העיצוב הקיים בשאר המקומות. */
  variant?: "default" | "hero";
  /** אלמנט שמוצג *בתוך* שורת החיפוש, בקצה הסופי שלה (פיזית שמאל ב-RTL) -
   *  למשל כפתור "קרוב אלי" (בקשה מפורשת: המיקום נכנס לתוך שורת החיפוש). */
  endAdornment?: ReactNode;
}

export function SearchBarLink({
  destinationMode = false,
  onSelectDestination,
  containerClassName = "relative mx-6",
  variant = "default",
  endAdornment,
}: SearchBarLinkProps = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<DestinationSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // *** תיקון (Audit - "לא נפתח כלום!! השרת כן מחזיר תוצאות"): הגרסה
  // הקודמת סגרה את התפריט לפי state נפרד (open) שתלוי בטיימינג עדין של
  // focus/blur/click-outside - שביר ולא ברור למה בדיוק נכשל בפועל.
  // עכשיו אין state כזה בכלל: התפריט מוצג פשוט כש-יש פוקוס + יש תוצאות
  // אמיתיות. סגירה בלחיצה על הצעה קורית כי selectDestination מנקה את
  // destinationSuggestions (החלק "יש תוצאות" הופך ל-false ממילא) - לא
  // צריך state נוסף לזה.
  useEffect(() => {
    // *** תיקון (Audit - "כתבתי ניו יורק, והוא לקח אותי לאילת!"): מנקים
    // את התוצאות הישנות **מיד** בכל שינוי טקסט - לפני שהבקשה החדשה
    // בכלל יוצאת. בלי זה, אם לוחצים Enter/על הצעה תוך כדי חלון ה-300ms
    // שלפני שהתוצאות החדשות חוזרות, ה-state עדיין מחזיק את התוצאות
    // *הקודמות* (מהחיפוש הקודם, "אילת") - ואז נבחר בטעות היעד הלא נכון.
    setPlaceSuggestions([]);
    setDestinationSuggestions([]);

    if (query.trim().length < 2) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (destinationMode) {
        // אותו endpoint בדיוק שבו TripMatch עצמו משתמש לבחירת יעד (עד
        // 12 תוצאות מהשרת - ר' /api/places/cities). *** תיקון (בקשה
        // מפורשת - "לא מופיעים כל היעדים, רק 2 נלחצים במקום שתהיה
        // גלילה"): לפני זה גזרנו כאן ל-2 התוצאות הראשונות בלבד, אז
        // לתפריט לא היה מה לגלול אליו. עכשיו מציגים את כל התוצאות
        // שהשרת מחזיר - התפריט עצמו נשאר קבוע בגובה (כ-2 שורות, ר'
        // max-h-[100px] למטה) עם גלילה פנימית לשאר.
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, destinationMode]);

  function goToSearch(q: string) {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function goToPlaceResult(id: string) {
    // *** שינוי (בקשה מפורשת - "רק ממאגר TRIPADD"): קודם ניווט
    // ל-/search/result?placeId=... שמביא פרטים מ-Google Place Details
    // (לא רלוונטי יותר לתוצאה שכבר הגיעה מ-tripadd_submissions) -
    // עכשיו ישר לעמוד האטרקציה עצמו (ר' TripAddPlaceView.tsx).
    router.push(`/place/${encodeURIComponent(id)}`);
  }

  function selectDestination(option: DestinationSuggestion) {
    setQuery(option.label);
    setDestinationSuggestions([]);
    // *** תיקון (Audit - "עובד תוך שנייה בעמוד TripMatch, תקוע דרך עמוד
    // הבית!"): היה option.label ("אילת, ישראל" - כולל מדינה, לתצוגה
    // בלבד). עמוד TripMatch העצמאי תמיד משתמש ב-option.value (שם עיר
    // נקי) - זו בדיוק המחרוזת ששמורה ב-DB.
    onSelectDestination?.(option.value);
  }

  function handleEnter() {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (destinationMode) {
      const topMatch = destinationSuggestions[0];
      if (topMatch) selectDestination(topMatch);
      return;
    }
    goToSearch(trimmed);
  }

  return (
    <div className={containerClassName}>
      <div
        className={
          variant === "hero"
            ? "flex h-12 items-center gap-2.5 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_6px_18px_-8px_rgba(0,50,120,0.28)] ring-1 ring-black/[0.06] transition focus-within:ring-2 focus-within:ring-[#0AA9FD]/40"
            : "flex items-center gap-2 rounded-pill border border-ink-secondary/15 bg-bg px-4 py-3 text-sm text-ink shadow-soft"
        }
      >
        <svg
          width={variant === "hero" ? 20 : 18}
          height={variant === "hero" ? 20 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={variant === "hero" ? "var(--color-primary-end)" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
          className={variant === "hero" ? "shrink-0" : "shrink-0 text-ink-secondary"}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
            setFocused(true);
          }}
          onBlur={() => {
            // דיליי קצר לפני סגירה - כדי שקליק על הצעה יספיק להירשם
            // לפני שהתפריט נעלם (onBlur בשדה קורה לפני onClick בפריט).
            blurTimeoutRef.current = setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEnter();
          }}
          placeholder={destinationMode ? "חפשו יעד או מקום שמעניין אתכם" : "חפש מסעדה, מלון, אטרקציה..."}
          className={
            variant === "hero"
              ? "w-full min-w-0 bg-transparent font-medium text-ink placeholder:font-normal placeholder:text-ink-secondary focus:outline-none"
              : "w-full bg-transparent text-ink placeholder:text-ink-secondary focus:outline-none"
          }
        />
        {endAdornment}
      </div>

      {!destinationMode && focused && placeSuggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-[120px] overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
          {placeSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goToPlaceResult(s.id)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-ink-secondary/10 px-4 py-2.5 text-start last:border-none hover:bg-bg-secondary"
            >
              <span className="text-sm font-medium text-ink">{s.mainText}</span>
              {s.secondaryText && <span className="text-xs text-ink-secondary">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}

      {destinationMode && focused && destinationSuggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-[100px] overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
          {destinationSuggestions.map((option) => (
            <button
              key={`${option.type}-${option.value}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
