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

type Stage = "city" | "category" | "swiping";

export default function TripMatchPage() {
  const router = useRouter();
  const { ready } = useFeatureOnboardingGuard("tripmatch", "/onboarding/tripmatch");
  const [stage, setStage] = useState<Stage>("city");
  const [heroVisible, setHeroVisible] = useState(true);

  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [categoryValue, setCategoryValue] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TripMatchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likedPlace, setLikedPlace] = useState<CandidatePlace | null>(null);

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
        .then((data) => setCityOptions(data.cities ?? []))
        .catch(() => setCityOptions([]));
    }, 300);
  }, [cityInput, selectedCity]);

  function handleSelectCity(city: string) {
    setSelectedCity(city);
    setCityInput(city);
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
        body: JSON.stringify({ city: selectedCity, interests: [value] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו להתחיל");
      setSessionId(data.session.id);
      setCandidates(data.candidates ?? []);
      setCandidateIndex(0);
      setStage("swiping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להתחיל, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (stage !== "swiping" || userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, [stage, userLocation]);

  const visibleCandidates = useMemo(() => {
    const filtered = applyFilters(candidates, filters);
    if (!userLocation) return filtered; // בלי מיקום אמיתי - לא ממציאים מספר
    return filtered.map((c) => {
      const distanceKm = haversineDistanceKm(userLocation, { lat: c.latitude, lng: c.longitude });
      return { ...c, distanceKm, etaMinutes: estimateTravelMinutes(distanceKm, "drive") };
    });
  }, [candidates, filters, userLocation]);
  const currentCandidate = visibleCandidates[candidateIndex];

  async function handleDecision(liked: boolean) {
    if (!sessionId || busy || !currentCandidate) return;
    const decidedPlace = currentCandidate;

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
        <div className="relative flex items-center gap-2 px-2 pt-4">
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
          city={selectedCity ?? ""}
          categoryLabel={categoryLabel}
          currentIndex={candidateIndex}
          total={visibleCandidates.length}
          onBack={() => router.push("/home")}
          onEditDestination={handleEditDestination}
          onEditCategory={handleEditCategory}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={countActiveFilters(filters)}
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
                <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
                  {cityOptions.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCity(city)}
                      className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {stage === "category" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה בא לכם לעשות ב{selectedCity}?</ChatBubble>
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
                  ? `לא מצאנו עדיין מקומות ב${selectedCity} בקטגוריה הזו.`
                  : visibleCandidates.length === 0
                    ? "אין תוצאות עם הפילטרים שנבחרו. נסו לרוקן חלק מהם."
                    : "נגמרו המועמדים כרגע."}
              </p>
            ) : (
              <SwipeCard key={currentCandidate.id} onSwipeLeft={() => handleDecision(false)} onSwipeRight={() => handleDecision(true)} disabled={busy}>
                <TripMatchCard candidate={currentCandidate} />
              </SwipeCard>
            )}
          </>
        )}
      </div>

      {filtersOpen && (
        <FiltersSheet candidates={candidates} filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
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
