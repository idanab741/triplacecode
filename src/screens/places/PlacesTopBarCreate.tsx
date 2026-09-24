"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAvatarUrl } from "@/constants/avatar";

interface PlacesTopBarCreateProps {
  onCreate: () => void;
  /** *** בקשה מפורשת (עמוד הבית): "flat" = שדה אפור שטוח בלי צל וטבעת, כמו שורות החיפוש
   *  של X/פייסבוק. ברירת מחדל "floating" - במפה השורה צפה מעל המפה וצריכה את הצל. */
  variant?: "floating" | "flat";
  placeholder?: string;
}

interface PersonResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
}

/**
 * *** תיקון (בקשה מפורשת - "שורת החיפוש מפנה אותי לעמוד אחר! צריך לחפש בחיפוש עצמו"):
 * השורה הייתה קישור ל-/places/search. עכשיו היא שדה חיפוש אמיתי - מקלידים ישר בתוכה, והתוצאות
 * (אנשים + יוצרים, אותו /api/social/search של העמוד הישן) נפתחות מתחתיה כתפריט, בלי לעבור עמוד.
 * לחיצה על תוצאה מובילה לפרופיל של האדם. העיצוב (זכוכית מגדלת סגולה, "חפש ב-place's", הקו המפריד
 * והעיגול עם הפלוס שפותח את CreateMenuSheet) נשאר בדיוק כמו קודם.
 *
 * אותו דפוס כמו SearchBarLink בבית: התפריט מוצג כשיש פוקוס + טקסט של 2 תווים לפחות, בלי state
 * "פתוח/סגור" נפרד. תוצאות ישנות מתנקות מיד בכל הקשה, ותשובה מאוחרת של בקשה קודמת נזרקת (cancelled).
 */
export function PlacesTopBarCreate({ onCreate, variant = "floating", placeholder = "חפש ב-place's" }: PlacesTopBarCreateProps) {
  const flat = variant === "flat";
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const term = query.trim();

  useEffect(() => {
    setResults(null);
    if (term.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/social/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((data: { people?: PersonResult[]; creators?: PersonResult[] }) => {
          if (cancelled) return;
          const creators = data.creators ?? [];
          const people = (data.people ?? []).filter((p) => !creators.some((c) => c.id === p.id));
          setResults([...creators, ...people]);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  const showPanel = focused && term.length >= 2;

  return (
    <div className="relative">
      <div
        className={
          flat
            ? "flex h-11 items-center gap-2.5 rounded-full bg-[#f0f1f4] px-4 text-[15px] text-ink transition-colors focus-within:bg-white focus-within:ring-1 focus-within:ring-[var(--color-places-purple)]"
            : "flex h-12 items-center gap-2.5 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_6px_18px_-8px_rgba(50,10,120,0.28)] ring-1 ring-black/[0.06] transition focus-within:ring-2 focus-within:ring-[var(--color-places-purple)]/40"
        }
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke={flat ? "var(--color-ink-secondary)" : "var(--color-places-purple)"}
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
            setFocused(true);
          }}
          onBlur={() => {
            // דיליי קצר - כדי שלחיצה על תוצאה תספיק להירשם לפני שהתפריט נסגר.
            blurTimeoutRef.current = setTimeout(() => setFocused(false), 150);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="search"
          className="w-full min-w-0 bg-transparent text-[16px] font-normal text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            aria-label="נקה חיפוש"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-secondary/15 text-[11px] font-bold text-ink-secondary"
          >
            ✕
          </button>
        )}

        {!flat && <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink-secondary/20" />}
        <button
          type="button"
          onClick={onCreate}
          aria-label="צור תוכן חדש"
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[17px] font-bold leading-none text-white"
            style={{
              background: flat
                ? "var(--color-places-purple)"
                : "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))",
            }}
          >
            +
          </span>
        </button>
      </div>

      {showPanel && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute inset-x-0 top-full z-20 mt-1.5 max-h-[300px] overflow-y-auto overscroll-contain bg-white ${
            flat ? "rounded-2xl ring-1 ring-black/[0.08] shadow-[0_12px_32px_-12px_rgba(15,20,25,0.25)]" : "rounded-card shadow-lg"
          }`}
        >
          {results === null && <p className="px-4 py-3 text-center text-sm text-ink-secondary">מחפש...</p>}
          {results !== null && results.length === 0 && (
            <p className="px-4 py-3 text-center text-sm text-ink-secondary">לא נמצאו תוצאות</p>
          )}
          {results?.map((person) => (
            <Link
              key={person.id}
              href={`/places/profile/${person.username ?? person.id}`}
              className="flex items-center gap-3 border-b border-ink-secondary/10 px-4 py-2.5 last:border-none hover:bg-bg-secondary"
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(person.avatar_url)} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[14px] font-bold text-ink">{person.full_name ?? person.username}</span>
                  {person.is_creator && <span style={{ color: "var(--color-places-purple)" }}>✓</span>}
                </span>
                {person.username && <span className="block text-[12px] text-ink-secondary">@{person.username}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
