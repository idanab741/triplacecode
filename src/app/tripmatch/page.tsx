"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Screen, SwipeCard } from "@/components/ui";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { CategoryPicker } from "@/screens/tripmatch/CategoryPicker";
import { SwipeHeader } from "@/screens/tripmatch/SwipeHeader";
import { TripMatchCard } from "@/screens/tripmatch/TripMatchCard";
import { LikedDialog } from "@/screens/tripmatch/LikedDialog";
import { FiltersSheet, EMPTY_FILTERS, applyFilters, countActiveFilters, type TripMatchFilters } from "@/screens/tripmatch/FiltersSheet";
import { MainBottomNav } from "@/components/MainBottomNav";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import type { CandidatePlace } from "@/services/tripBuilder/types";
import { useFeatureOnboardingGuard } from "@/hooks/useFeatureOnboardingGuard";
import { getCategoryLabel } from "@/utils/categoryLabels";

type Stage = "city" | "category" | "swiping" | "results";

type UserPreferences = { interests: string[]; culinaryStyles: string[]; kosher: boolean; accessibility: boolean };

/** ניקוד התאמה (60-99%): דירוג המקום + **התאמה אמיתית לפרופיל מהאונבורדינג**
 *  (תחומי עניין וסגנון קולינרי שהמשתמש בחר בהעדפות, כשרות ונגישות אם
 *  ביקש) + חפיפה עם הפילטרים הידניים שנבחרו כרגע. לפני זה זה התבסס רק
 *  על דירוג גוגל + פילטרים ידניים - בלי שום קשר להעדפות שהמשתמש כבר
 *  ענה עליהן באונבורדינג. */
function computeMatchPercent(candidate: CandidatePlace, filters: TripMatchFilters, userPreferences: UserPreferences | null): number {
  let score = 45;
  if (candidate.rating != null) score += (candidate.rating / 5) * 15;

  const candidateTags = new Set([...candidate.tripTypeTags, ...candidate.cuisineTags, ...(candidate.tags ?? [])]);
  const onboardingTags = [...(userPreferences?.interests ?? []), ...(userPreferences?.culinaryStyles ?? [])];

  if (onboardingTags.length > 0) {
    const overlap = onboardingTags.filter((t) => candidateTags.has(t)).length;
    score += Math.min(1, overlap / Math.min(onboardingTags.length, 5)) * 15;
  }

  // *** נוסף: ציוני TripMatch/DNA שהאדמין קבע ידנית או עם "✨ תקן עם AI"
  // (tripmatch_scores/dna_scores) - עד עכשיו בכלל לא נלקחו בחשבון כאן,
  // למרות שזו בדיוק המטרה שלהם.
  const adminScores = [...Object.values(candidate.tripmatchScores ?? {}), ...Object.values(candidate.dnaScores ?? {})];
  if (adminScores.length > 0) {
    const avg = adminScores.reduce((a, b) => a + b, 0) / adminScores.length;
    score += (avg / 100) * 15;
  }

  if (filters.tags.length > 0) {
    const overlap = filters.tags.filter((t) => candidateTags.has(t)).length;
    score += (overlap / filters.tags.length) * 10;
  } else if (onboardingTags.length === 0 && adminScores.length === 0) {
    score += 8; // אין שום מידע (לא פילטר, לא אונבורדינג, לא תיוג אדמין) - ציון בסיס נדיב
  }

  if (userPreferences?.kosher && candidate.kosher) score += 5;
  if (userPreferences?.accessibility && candidate.accessible) score += 5;

  return Math.max(60, Math.min(99, Math.round(score)));
}

export default function TripMatchPage() {
  const router = useRouter();
  const { ready } = useFeatureOnboardingGuard("tripmatch", "/onboarding/tripmatch");
  const [stage, setStage] = useState<Stage>("city");
  const [heroVisible, setHeroVisible] = useState(true);

  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string; type: "city" | "country" }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCityLabel, setSelectedCityLabel] = useState<string>("");

  const [categoryValue, setCategoryValue] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>("");
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TripMatchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likedPlace, setLikedPlace] = useState<CandidatePlace | null>(null);
  const [sessionLikedPlaces, setSessionLikedPlaces] = useState<CandidatePlace[]>([]);
  const [hasSwipedAny, setHasSwipedAny] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedCity) return;
    if (cityInput.trim().length < 2) {
      setCityOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/cities?q=${encodeURIComponent(cityInput.trim())}`)
        .then((res) => res.json())
        .then((data) => setCityOptions(data.options ?? []))
        .catch(() => setCityOptions([]));
    }, 300);
  }, [cityInput, selectedCity]);

  function handleSelectCity(option: { value: string; label: string; type: "city" | "country" }) {
    setSelectedCity(option.value);
    setSelectedCityLabel(option.label);
    setCityInput(option.label);
    setCityOptions([]);
    // ה-HERO נעלם ב-Fade+Slide (הטרנזישן מוגדר על ה-wrapper), ורק אז עוברים שלב
    setHeroVisible(false);
    window.setTimeout(() => setStage("category"), 280);
  }

  function handleEditDestination() {
    setStage("city");
    setHeroVisible(true);
    setCategoryValue(null);
  }

  function handleEditCategory() {
    setStage("category");
  }

  async function handleSelectCategory(value: string, label: string) {
    setCategoryValue(value);
    setCategoryLabel(label);
    if (!selectedCity || busy) return;
    setBusy(true);
    setError(null);
    setFilters(EMPTY_FILTERS);
    try {
      const response = await fetch("/api/tripmatch/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: selectedCity, category: value, interests: [] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו להתחיל");
      setSessionId(data.session.id);
      setCandidates(data.candidates ?? []);
      setUserPreferences(data.userPreferences ?? null);
      setCandidateIndex(0);
      setStage("swiping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להתחיל, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // *** נוסף: מסיים את הסבב באופן יזום (כפתור "סיימתי לסרוק ✓") - בלי
  // זה, המשתמש חייב להחליק את כל המאגר (יכול להיות עשרות/מאות מקומות,
  // במיוחד אחרי שהתיקון להחרגה קבועה נוסף) לפני שהמעבר קורה לבד.
  function handleFinish() {
    if (sessionLikedPlaces.length === 0) {
      router.push("/home");
    } else {
      setStage("results");
    }
  }

  // *** נוסף: כשנגמרים המועמדים אחרי שכבר החליקו לפחות פעם אחת - אם לא
  // סימנו שום לייק, חוזרים ישר לעמוד הבית (אין טעם במסך תוצאות ריק).
  // אם כן סימנו לייקים, עוברים למסך תוצאות (כמו עמוד מסלול, בלי מפה).
  useEffect(() => {
    if (stage === "swiping" && hasSwipedAny && candidates.length === 0 && !busy) {
      handleFinish();
    }
  }, [stage, hasSwipedAny, candidates, busy, sessionLikedPlaces, router]);

  useEffect(() => {
    if (stage !== "swiping" || userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, [stage, userLocation]);

  const visibleCandidates = useMemo(() => {
    const filtered = applyFilters(candidates, filters);
    const withDistance = !userLocation
      ? filtered
      : filtered.map((c) => {
          const distanceKm = haversineDistanceKm(userLocation, { lat: c.latitude, lng: c.longitude });
          return { ...c, distanceKm, etaMinutes: estimateTravelMinutes(distanceKm, "drive") };
        });
    // *** נוסף: מיון לפי אחוז התאמה - מהגבוה לנמוך, כדי שהמקומות
    // הכי מתאימים למשתמש יוצגו קודם בהחלקה, לא לפי סדר אקראי מה-DB.
    return [...withDistance].sort(
      (a, b) => computeMatchPercent(b, filters, userPreferences) - computeMatchPercent(a, filters, userPreferences)
    );
  }, [candidates, filters, userLocation, userPreferences]);
  const currentCandidate = visibleCandidates[candidateIndex];

  async function handleDecision(liked: boolean) {
    if (!sessionId || busy || !currentCandidate) return;
    const decidedPlace = currentCandidate;
    setHasSwipedAny(true);
    if (liked) setSessionLikedPlaces((prev) => [...prev, decidedPlace]);

    setBusy(true);
    try {
      const response = await fetch(`/api/tripmatch/sessions/${sessionId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: decidedPlace.id, liked }),
      });
      const data = await response.json();
      if (response.ok) {
        setCandidates(data.candidates ?? []);
        setCandidateIndex(0);
      } else {
        setCandidateIndex((i) => i + 1);
      }
    } catch {
      setCandidateIndex((i) => i + 1);
    } finally {
      setBusy(false);
    }

    // אין מעבר אוטומטי אחרי Like - עוצרים על Dialog, בדיוק כמו במפרט
    if (liked) setLikedPlace(decidedPlace);
  }

  if (!ready) return null;

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      {stage !== "swiping" && (
        <div className="relative h-16">
          <div className="absolute left-2 top-4 flex items-center gap-2">
            <Image src="/images/trip-tripmatch-logo.png" alt="" width={130} height={40} className="object-contain" />
            <button
              type="button"
              onClick={() => router.push("/home")}
              aria-label="חזרה"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {stage !== "swiping" && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: heroVisible ? 260 : 0, opacity: heroVisible ? 1 : 0 }}
        >
          <div className="relative w-full">
            <Image src="/images/hero-tripmatch.png" alt="" width={800} height={450} priority className="h-56 w-full object-cover" />
          </div>
        </div>
      )}

      {stage === "swiping" && currentCandidate && (
        <SwipeHeader
          city={selectedCityLabel || selectedCity || ""}
          categoryLabel={categoryLabel}
          currentIndex={candidateIndex}
          total={visibleCandidates.length}
          onBack={() => router.push("/home")}
          onEditDestination={handleEditDestination}
          onEditCategory={handleEditCategory}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={countActiveFilters(filters)}
          onFinish={handleFinish}
        />
      )}

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-10 pt-5">
        {stage === "city" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>
              החליקו ימינה למקומות שאהבתם ושמאלה לאלה שפחות. ככל שתמשיכו להחליק, נכיר טוב יותר את הטעם שלכם ונמצא
              עבורכם את ההתאמה המושלמת.{"\n\n"}
              אז בואו נתחיל - איפה תרצו לטייל?
            </ChatBubble>

            <div className="relative">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value);
                  setSelectedCity(null);
                }}
                placeholder="לדוגמה: תל אביב, פריז..."
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {cityOptions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
                  {cityOptions.map((option) => (
                    <button
                      key={`${option.type}-${option.value}`}
                      type="button"
                      onClick={() => handleSelectCity(option)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                    >
                      <span>{option.label}</span>
                      {option.type === "country" && (
                        <span className="text-[11px] text-ink-secondary">מדינה שלמה</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {stage === "category" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה בא לכם לעשות ב{selectedCityLabel || selectedCity}?</ChatBubble>
            <CategoryPicker onSelect={handleSelectCategory} />
            {busy && <p className="text-center text-sm text-ink-secondary">טוען...</p>}
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {stage === "swiping" && (
          <>
            {!currentCandidate ? (
              <p className="pt-16 text-center text-ink-secondary">
                {candidates.length === 0
                  ? `לא מצאנו עדיין מקומות ב${selectedCityLabel || selectedCity} בקטגוריה הזו.`
                  : visibleCandidates.length === 0
                    ? "אין תוצאות עם הפילטרים שנבחרו. נסו לרוקן חלק מהם."
                    : "נגמרו המועמדים כרגע."}
              </p>
            ) : (
              <SwipeCard key={currentCandidate.id} onSwipeLeft={() => handleDecision(false)} onSwipeRight={() => handleDecision(true)} disabled={busy}>
                <TripMatchCard candidate={currentCandidate} matchPercent={computeMatchPercent(currentCandidate, filters, userPreferences)} />
              </SwipeCard>
            )}
          </>
        )}

        {stage === "results" && (
          <div className="flex flex-col gap-4">
            <ChatBubble>
              {sessionLikedPlaces.length > 0
                ? `סיימנו לסרוק את ${selectedCityLabel || selectedCity}! אלה ${sessionLikedPlaces.length} המקומות שאהבתם:`
                : `סיימנו לסרוק את ${selectedCityLabel || selectedCity} - לא סימנתם לייק הפעם, נסו יעד או קטגוריה אחרת.`}
            </ChatBubble>

            {sessionLikedPlaces.length > 0 && (
              <div className="flex flex-col gap-3">
                {sessionLikedPlaces.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => router.push(`/place/${place.id}`)}
                    className="flex items-center gap-3 rounded-card bg-white p-3 text-right shadow-soft"
                  >
                    {place.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={place.imageUrls[0]} alt="" className="h-16 w-16 shrink-0 rounded-[14px] object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-bg-secondary text-2xl">📍</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink">{place.name}</p>
                      <p className="text-[12.5px] text-ink-secondary">
                        {getCategoryLabel(place.category)}
                        {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setStage("city");
                setHeroVisible(true);
                setSelectedCity(null);
                setSelectedCityLabel("");
                setCityInput("");
                setCategoryValue(null);
                setSessionLikedPlaces([]);
                setHasSwipedAny(false);
                setCandidates([]);
              }}
              className="rounded-pill py-3 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              יעד חדש
            </button>
          </div>
        )}
      </div>

      {filtersOpen && (
        <FiltersSheet
          candidates={candidates}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          preferredTags={[...(userPreferences?.interests ?? []), ...(userPreferences?.culinaryStyles ?? [])]}
        />
      )}

      {likedPlace && (
        <LikedDialog
          placeName={likedPlace.name}
          onContinue={() => setLikedPlace(null)}
          onViewPlace={() => router.push(`/place/${likedPlace.id}`)}
        />
      )}

      <MainBottomNav active="favorites" />
    </Screen>
  );
}
