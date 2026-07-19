"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen, Stepper, SwipeCard } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { PlaceSwipeCardContent } from "@/screens/trip-builder/PlaceSwipeCardContent";
import { PlaceInfoSheet } from "@/screens/trip-builder/PlaceInfoSheet";
import type { CandidatePlace, TripBuilderStop } from "@/services/tripBuilder/types";

interface SessionResponse {
  session: { id: string };
  stops: TripBuilderStop[];
}

function DayTripBuildContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [stops, setStops] = useState<TripBuilderStop[] | null>(null);
  const [candidates, setCandidates] = useState<CandidatePlace[] | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStop = stops?.find((s) => s.status === "pending");

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    const response = await fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`);
    const data: SessionResponse = await response.json();
    if (!response.ok) {
      setError("לא הצלחנו לטעון את הטיול");
      return;
    }
    setStops(data.stops);
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      await loadSession();
    })();
  }, [loadSession]);

  const loadCandidates = useCallback(async () => {
    if (!sessionId || !currentStop) return;
    setCandidates(null);
    setCandidateIndex(0);
    const response = await fetch(
      `/api/trip-builder/sessions/${sessionId}/stops/${currentStop.id}/candidates`
    );
    const data = await response.json();
    if (!response.ok) {
      setError("לא הצלחנו לטעון מועמדים לתחנה הזו");
      return;
    }
    setCandidates(data.candidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentStop?.id]);

  useEffect(() => {
    (async () => {
      if (currentStop) await loadCandidates();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStop?.id]);

  const finalize = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`/api/trip-builder/sessions/${sessionId}/finalize`, { method: "POST" });
    router.push(`/trip-builder/day-trip/result?sessionId=${sessionId}`);
  }, [sessionId, router]);

  useEffect(() => {
    if (stops && !currentStop) {
      finalize();
    }
  }, [stops, currentStop, finalize]);

  async function handleLike() {
    if (!sessionId || !currentStop || !candidates || busy) return;
    const candidate = candidates[candidateIndex];
    if (!candidate) return;

    setBusy(true);
    await fetch(`/api/trip-builder/sessions/${sessionId}/stops/${currentStop.id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate }),
    });
    await loadSession();
    setBusy(false);
  }

  async function handleUnlike() {
    if (!sessionId || !currentStop || !candidates || busy) return;
    const candidate = candidates[candidateIndex];
    if (!candidate) return;

    setBusy(true);
    await fetch(`/api/trip-builder/sessions/${sessionId}/stops/${currentStop.id}/unlike`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate }),
    });

    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((i) => i + 1);
    } else {
      await loadCandidates();
    }
    setBusy(false);
  }

  async function handleSkipStop() {
    if (!sessionId || !currentStop || busy) return;
    setBusy(true);
    await fetch(`/api/trip-builder/sessions/${sessionId}/stops/${currentStop.id}/skip`, {
      method: "POST",
    });
    await loadSession();
    setBusy(false);
  }

  if (error) {
    return (
      <Screen>
        <p className="pt-10 text-center text-danger">{error}</p>
      </Screen>
    );
  }

  if (!stops || !currentStop) {
    return (
      <Screen>
        <p className="pt-10 text-center text-ink-secondary">בונים את הטיול שלכם...</p>
      </Screen>
    );
  }

  const totalStops = stops.length;
  const doneStops = stops.filter((s) => s.status === "liked").length;
  const nextStop = stops.find((s) => s.slot_index > currentStop.slot_index);
  const candidate = candidates?.[candidateIndex];

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto flex max-w-sm flex-col gap-4 pt-6">
        <Stepper
          current={doneStops + 1}
          total={totalStops}
          label={getCategoryLabel(currentStop.category)}
        />

        {!candidates ? (
          <p className="pt-16 text-center text-ink-secondary">מחפשים מקומות מתאימים...</p>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-16 text-center text-ink-secondary">
            <p>לא מצאנו מספיק מקומות בקטגוריה הזו כרגע.</p>
            <button
              type="button"
              onClick={handleSkipStop}
              disabled={busy}
              className="rounded-pill bg-bg-secondary px-5 py-2 text-sm font-medium text-ink"
            >
              דלגו על התחנה הזו
            </button>
          </div>
        ) : candidate ? (
          <SwipeCard
            key={candidate.id}
            onSwipeLeft={handleUnlike}
            onSwipeRight={handleLike}
            disabled={busy}
          >
            <PlaceSwipeCardContent candidate={candidate} onInfoClick={() => setShowInfo(true)} />
          </SwipeCard>
        ) : (
          <p className="pt-16 text-center text-ink-secondary">נגמרו המועמדים בקטגוריה הזו.</p>
        )}
      </div>

      {showInfo && candidate && (
        <PlaceInfoSheet candidate={candidate} onClose={() => setShowInfo(false)} />
      )}
    </Screen>
  );
}

export default function DayTripBuildPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <DayTripBuildContent />
    </Suspense>
  );
}
