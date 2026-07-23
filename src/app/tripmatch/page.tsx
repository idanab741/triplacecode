"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen, SwipeCard } from "@/components/ui";
import { ChipGroup } from "@/components/ui";
import { TRIPMATCH_INTEREST_OPTIONS } from "@/locales/he/tripBuilder";
import { TripMatchCardContent } from "@/screens/tripmatch/TripMatchCardContent";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import type { CandidatePlace } from "@/services/tripBuilder/types";

type Stage = "city" | "interests" | "swiping";

export default function TripMatchPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("city");

  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // השלמה אוטומטית לערים, עם debounce כדי לא להציף את השרת בכל הקשה
  useEffect(() => {
    if (selectedCity) return; // כבר נבחרה עיר - לא ממשיכים לחפש
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
    setStage("interests");
  }

  async function handleStartSwiping() {
    if (!selectedCity || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tripmatch/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: selectedCity, interests: selectedInterests }),
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

  async function handleDecision(liked: boolean) {
    if (!sessionId || busy) return;
    const candidate = candidates[candidateIndex];
    if (!candidate) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/tripmatch/sessions/${sessionId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: candidate.id, liked }),
      });
      const data = await response.json();
      if (response.ok) {
        // מזינים מחדש מהשרת - כך שגם מועמדים חדשים (שלא היו ברשימה הראשונית) יכולים להצטרף
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
  }

  const currentCandidate = candidates[candidateIndex];

return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
<div className="flex items-center justify-end gap-2 px-4 pt-4">
          <Image src="/images/trip-tripmatch-logo.png" alt="" width={130} height={40} className="object-contain" />
        <Link
          href="/home"
          className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
          aria-label="חזרה לדף הבית"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 w-full">
        <Image
          src="/images/hero-tripmatch.png"
          alt=""
          width={800}
          height={450}
          priority
          className="h-56 w-full object-cover"
        />
      </div>

      <div className="mx-auto flex max-w-sm flex-col gap-4 px-5 pb-10 pt-5">
        {stage === "city" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>
              ברוכים הבאים ל-tripmatch!{"\n"}
              כאן תגלו את היעד הבא שלכם בדרך הכי פשוטה: החליקו ימינה למקומות שאהבתם ושמאלה לאלה
              שפחות. ככל שתמשיכו להחליק, נכיר טוב יותר את הטעם שלכם ונמצא עבורכם את ההתאמה
              המושלמת.{"\n\n"}
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

{stage === "interests" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה בא לכם לעשות ב{selectedCity}?</ChatBubble>
            <ChipGroup options={TRIPMATCH_INTEREST_OPTIONS} selected={selectedInterests} onChange={setSelectedInterests} />
            <button
              type="button"
              onClick={handleStartSwiping}
              disabled={busy}
              className="mt-2 w-full rounded-pill py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {busy ? "טוען..." : "בואו נתחיל להחליק"}
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {stage === "swiping" && (
          <>
            {!currentCandidate ? (
              <p className="pt-16 text-center text-ink-secondary">
                {candidates.length === 0
                  ? `לא מצאנו עדיין מקומות ב${selectedCity} בקטגוריות שבחרתם.`
                  : "נגמרו המועמדים כרגע."}
              </p>
            ) : (
              <SwipeCard
                key={currentCandidate.id}
                onSwipeLeft={() => handleDecision(false)}
                onSwipeRight={() => handleDecision(true)}
                disabled={busy}
              >
                <TripMatchCardContent candidate={currentCandidate} />
              </SwipeCard>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}