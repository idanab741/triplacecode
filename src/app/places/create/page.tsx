"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Input, ImageOptionRow, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { searchPlaces, type PlaceSearchResult } from "@/services/places/searchService";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";

const CATEGORIES: { id: PlaceSubmissionCategory; label: string; imageSrc?: string; icon?: ReactNode }[] = [
  { id: "restaurant", label: "מסעדה", imageSrc: "/images/tripmatch/category-restaurants.png" },
  { id: "attraction", label: "אטרקציה", imageSrc: "/images/tripmatch/category-attractions.png" },
  { id: "nature", label: "טבע ונופים", imageSrc: "/images/tripmatch/category-nature.png" },
  { id: "nightlife", label: "חיי לילה ובילויים", imageSrc: "/images/tripmatch/category-nightlife.png" },
  { id: "hotel", label: "מלונות", imageSrc: "/images/places-menu-hotel.png" },
];

interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface GoogleDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

type Step = "search" | "add" | "added";

/**
 * "על איזה מקום בא לכם לספר?" - שלב ראשון בזרימת "מקום" (+ -> מקום). עמוד מלא עם הבר העליון של
 * Places (חובה), לא Bottom Sheet. המשתמש לא צריך להבין אם המקום קיים או חדש:
 *  - קיים -> ישר ל-/places/create/review
 *  - לא קיים -> "הוסיפו מקום" (טופס קצר) -> המקום נוצר מיד -> ממשיכים לביקורת.
 */
export default function CreatePlaceStepPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("search");

  // חיפוש מקום קיים
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // הוספת מקום חדש
  const [category, setCategory] = useState<PlaceSubmissionCategory | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState<GoogleDetails | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState<{ id: string; name: string; type: "place" | "destination" } | null>(null);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createdPlace, setCreatedPlace] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  function goToReview(placeId: string) {
    router.push(`/places/create/review?placeId=${encodeURIComponent(placeId)}`);
  }

  function handleBack() {
    if (step === "add") setStep("search");
    else if (step === "added") router.replace("/places");
    else router.back();
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(
          { query: value.trim(), categories: [], minRating: null, maxPriceLevel: null, kosher: false, accessible: false },
          0,
          15
        );
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleNameChange(value: string) {
    setNameQuery(value);
    setSelected(null);
    setDuplicateOf(null);
    setError(null);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (value.trim().length < 3) {
      setSuggestions(null);
      return;
    }
    suggestTimerRef.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const res = await fetch(`/api/places/google-autocomplete?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 400);
  }

  async function handleSelectSuggestion(s: AutocompleteSuggestion) {
    setSuggestions(null);
    setNameQuery(s.mainText);
    setCheckingDuplicate(true);
    setError(null);
    try {
      const details = await fetch(`/api/places/search-result-details?placeId=${encodeURIComponent(s.placeId)}`).then((r) => r.json());
      const dupParams = new URLSearchParams({ placeId: s.placeId });
      if (details.name) dupParams.set("name", details.name);
      if (details.latitude != null) dupParams.set("lat", String(details.latitude));
      if (details.longitude != null) dupParams.set("lng", String(details.longitude));
      const dup = await fetch(`/api/social/place-submissions/check-duplicate?${dupParams}`).then((r) => r.json());

      if (dup.exists) {
        setDuplicateOf(dup.place);
        setSelected(null);
        return;
      }
      setSelected({
        placeId: s.placeId,
        name: details.name ?? s.mainText,
        address: details.address ?? s.secondaryText,
        latitude: details.latitude,
        longitude: details.longitude,
      });
    } catch {
      setError("שגיאה בטעינת פרטי המקום");
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function handleAddPlace() {
    if (!nameQuery.trim()) return setError("מה שם המקום?");
    if (!category) return setError("מה סוג המקום?");
    if (!selected) return setError("בחרו את המקום מתוך ההצעות כדי שנדע איפה הוא נמצא");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          category,
          googlePlaceId: selected.placeId,
          address: selected.address,
          latitude: selected.latitude,
          longitude: selected.longitude,
          website: website.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה בהוספת המקום");
      // המקום נוצר (או שכבר היה קיים) - לא מחזירים ל-Places ולא מחפשים שוב, ממשיכים ישר.
      setCreatedPlace({ id: data.id, name: data.name });
      setStep("added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white">
        <PlacesHeader variant="purple" onBack={() => router.back()} />
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={handleBack} />

      <div className="px-5 pt-6">
        {step === "search" && (
          <>
            <h1 className="mb-4 text-[22px] font-extrabold leading-tight text-ink">על איזה מקום בא לכם לספר?</h1>
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="🔍 חפשו מקום..."
              className="mb-4 w-full rounded-pill border border-ink-secondary/20 px-4 py-3 text-[16px] focus:outline-none"
              style={{ borderColor: query ? "var(--color-places-purple)" : undefined }}
            />

            {searching && (
              <div>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="mb-2 h-16 w-full" />
                ))}
              </div>
            )}

            {!searching &&
              results?.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => goToReview(place.id)}
                  className="flex w-full items-center gap-3 rounded-card px-1 py-2.5 text-start hover:bg-bg-secondary"
                >
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {place.image_urls?.[0] && <img src={place.image_urls[0]} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{place.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-secondary">
                      {[getPlaceCategoryLabel(place.category), place.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {place.rating != null && <span className="shrink-0 text-[13px] font-semibold text-ink">⭐ {place.rating.toFixed(1)}</span>}
                </button>
              ))}

            {/* אין תוצאות - לא רק הודעת שגיאה: מציעים להוסיף את המקום. */}
            {results !== null && !searching && results.length === 0 && (
              <div className="rounded-card bg-bg-secondary px-4 py-6 text-center">
                <p className="text-[15px] font-bold text-ink">לא מצאתם את המקום?</p>
                <p className="mb-4 mt-1 text-[13px] text-ink-secondary">עזרו לנו להוסיף אותו ל־TRIPLACE</p>
                <button
                  type="button"
                  onClick={() => {
                    setNameQuery(query);
                    if (query.trim().length >= 3) handleNameChange(query);
                    setStep("add");
                  }}
                  className="rounded-pill px-6 py-2.5 text-[14px] font-bold text-white"
                  style={{ background: PURPLE_GRADIENT }}
                >
                  + הוספת מקום
                </button>
              </div>
            )}

            {(results === null || results.length > 0) && !searching && (
              <button
                type="button"
                onClick={() => setStep("add")}
                className="mt-4 w-full text-center text-[13px] font-semibold"
                style={{ color: "var(--color-places-purple)" }}
              >
                לא מצאתם את המקום? + הוספת מקום
              </button>
            )}
          </>
        )}

        {step === "add" && (
          <>
            <h1 className="mb-5 text-[22px] font-extrabold leading-tight text-ink">הוסיפו מקום</h1>

            <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">מה שם המקום?</label>
            <div className="relative mb-1">
              <Input value={nameQuery} onChange={(e) => handleNameChange(e.target.value)} placeholder="לדוגמה: קפה השעון" />
              {(suggesting || suggestions) && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-card bg-white shadow-soft ring-1 ring-black/5">
                  {suggesting && <p className="p-3 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}
                  {!suggesting &&
                    suggestions?.map((s) => (
                      <button key={s.placeId} type="button" onClick={() => handleSelectSuggestion(s)} className="block w-full px-3 py-2.5 text-start hover:bg-bg-secondary">
                        <span className="block text-[13.5px] font-semibold text-ink">{s.mainText}</span>
                        <span className="block text-[11.5px] text-ink-secondary">{s.secondaryText}</span>
                      </button>
                    ))}
                  {!suggesting && suggestions?.length === 0 && <p className="p-3 text-center text-[12.5px] text-ink-secondary">לא נמצאו תוצאות</p>}
                </div>
              )}
            </div>

            {checkingDuplicate && <p className="mb-2 text-[12px] text-ink-secondary">בודקים אם המקום כבר קיים...</p>}

            {/* המערכת מחליטה מאחורי הקלעים: אם המקום כבר קיים - ממשיכים לביקורת, בלי להסביר. */}
            {duplicateOf && (
              <div className="mb-3 mt-2 rounded-card bg-bg-secondary p-3">
                <p className="text-[13px] text-ink">מצאנו את &quot;{duplicateOf.name}&quot; - הוא כבר אצלנו 🎉</p>
                {duplicateOf.type === "place" && (
                  <button
                    type="button"
                    onClick={() => goToReview(duplicateOf.id)}
                    className="mt-2 w-full rounded-pill py-2.5 text-[13.5px] font-bold text-white"
                    style={{ background: PURPLE_GRADIENT }}
                  >
                    כתיבת ביקורת
                  </button>
                )}
              </div>
            )}

            {selected && (
              <div className="mb-3 mt-2 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
                <span style={{ color: "var(--color-places-purple)" }}>📍</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-ink-secondary">איפה הוא נמצא?</span>
                  <span className="block truncate text-[13px] font-semibold text-ink">{selected.address}</span>
                </span>
              </div>
            )}

            <label className="mb-2 mt-4 block text-[13px] font-semibold text-ink-secondary">מה סוג המקום?</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <ImageOptionRow
                  key={c.id}
                  selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  label={c.label}
                  imageSrc={c.imageSrc}
                  icon={c.icon}
                  selectedGradient={PURPLE_GRADIENT}
                />
              ))}
            </div>

            <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">אינסטגרם / אתר (אופציונלי)</label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />

            {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}

            <button
              type="button"
              disabled={submitting || checkingDuplicate || !!duplicateOf}
              onClick={handleAddPlace}
              className="mt-6 w-full rounded-pill py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: PURPLE_GRADIENT }}
            >
              {submitting ? "מוסיפים..." : "הוספת מקום"}
            </button>
          </>
        )}

        {step === "added" && createdPlace && (
          <div className="flex flex-col items-center px-2 pt-12 text-center">
            <p className="text-[22px] font-extrabold text-ink">מעולה! הוספנו את המקום 🎉</p>
            <p className="mb-8 mt-2 text-[15px] text-ink-secondary">רוצים לספר לאחרים איך היה לכם?</p>
            <button
              type="button"
              onClick={() => goToReview(createdPlace.id)}
              className="w-full rounded-pill py-3.5 text-[15px] font-bold text-white"
              style={{ background: PURPLE_GRADIENT }}
            >
              כתיבת ביקורת
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
