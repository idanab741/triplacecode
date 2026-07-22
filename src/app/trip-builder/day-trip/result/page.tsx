"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Button, Screen } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getTripDayOfWeek, minutesToTimeLabel, parseOpeningHoursForDay } from "@/utils/openingHours";
import type { DayTripAnswers, FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function DayTripResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualStartMinutes, setManualStartMinutes] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState(false);
  const [swappingStopId, setSwappingStopId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  async function handleSwapStop(stopId: string) {
    if (!sessionId || swappingStopId) return;
    setSwappingStopId(stopId);
    setSwapError(null);
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/stops/${stopId}/swap`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ההחלפה נכשלה");
      setSession((s) => (s ? { ...s, final_itinerary: data.itinerary } : s));
    } catch (error) {
      setSwapError(error instanceof Error ? error.message : "ההחלפה נכשלה, נסו שוב");
    } finally {
      setSwappingStopId(null);
    }
  }

  useEffect(() => {

    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.session) {
          setError("לא הצלחנו לטעון את הטיול");
          return;
        }
        setSession(data.session);
      })
      .catch(() => setError("לא הצלחנו לטעון את הטיול"));
  }, [sessionId]);
const itinerary: FinalItinerary | null = session?.final_itinerary ?? null;
  const answers = session?.answers as unknown as DayTripAnswers | undefined;

  const defaultStartMinutes = useMemo(() => {
    if (!itinerary || !answers || itinerary.stops.length === 0) return 9 * 60; // ברירת מחדל 09:00
    const dayOfWeek = getTripDayOfWeek(answers.timing, answers.otherDate);
    const hours = parseOpeningHoursForDay(itinerary.stops[0].openingHours, dayOfWeek);
    if (hours && hours !== "closed") return hours.openMinutes;
    return 9 * 60;
  }, [itinerary, answers]);

  const startMinutes = manualStartMinutes ?? defaultStartMinutes;

  if (error) {
    return (
      <Screen>
        <p className="pt-10 text-center text-danger">{error}</p>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <p className="pt-10 text-center text-ink-secondary">טוען את המסלול...</p>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא נבחרו מספיק תחנות כדי לבנות מסלול.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      {/* Hero עליון עם הלוגו בפינה */}
      <div className="relative w-full">
        <Image
          src="/images/hero-day-trip-result.png"
          alt="הטיול שלכם מוכן"
          width={800}
          height={450}
          priority
          className="h-56 w-full object-cover"
        />
        <div className="absolute right-4 top-4">
          <Image src="/images/tripy.png" alt="TRIPLACE" width={40} height={40} className="rounded-full" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-10">
          <h1 className="text-xl font-bold text-white">הטיול שלכם מוכן!</h1>
          <p className="mt-1 text-sm text-white/90">
            {itinerary.stops.length} תחנות · כ-{Math.round(itinerary.totalEtaMinutes / 60)} שעות נסיעה
          </p>
        </div>
      </div>

<div className="mx-auto flex max-w-sm flex-col gap-5 px-5 pb-10 pt-5">
        <div className="flex items-center justify-between rounded-card bg-white px-4 py-3 shadow-soft">
          <span className="text-sm text-ink-secondary">שעת יציאה</span>
          {editingTime ? (
            <input
              type="time"
              defaultValue={minutesToTimeLabel(startMinutes)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setManualStartMinutes(h * 60 + m);
              }}
              onBlur={() => setEditingTime(false)}
              autoFocus
              className="rounded border border-ink-secondary/25 px-2 py-1 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTime(true)}
              className="text-sm font-semibold text-accent"
            >
              {minutesToTimeLabel(startMinutes)} ✏️
            </button>
          )}
        </div>

        {itinerary.warnings.length > 0 && (
          <div className="rounded-card bg-bg-secondary p-3 text-sm text-ink-secondary">
            {itinerary.warnings.map((warning) => (
              <p key={warning}>⚠️ {warning}</p>
            ))}
          </div>
        )}

        {/* מפה אינטראקטיבית - Leaflet + OpenStreetMap, חינמי לגמרי */}
        <ResultMap
          stops={itinerary.stops.map((s) => ({
            stopId: s.stopId,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
          }))}
        />

<div className="flex flex-col gap-3">
          {itinerary.stops.map((stop, index) => (
 <div key={stop.stopId} className="flex gap-3 overflow-hidden rounded-card bg-white p-3 shadow-soft">
              {stop.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stop.imageUrls[0]}
                  alt={stop.name}
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-secondary">
                    תחנה {index + 1} · {getCategoryLabel(stop.category)}
                  </p>
                  <p className="shrink-0 text-sm font-bold text-accent">
                    🕐 {minutesToTimeLabel(startMinutes + stop.arrivalOffsetMinutes)}
                  </p>
                </div>
                <p className="truncate font-semibold text-ink">{stop.name}</p>
                {stop.shortDescription && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">
                    {stop.shortDescription}
                  </p>
                )}
<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-secondary">
                  <span>🚗 {stop.etaMinutes} דק&apos; נסיעה</span>
                  {stop.estimatedVisitMinutes && <span>⏱️ {stop.estimatedVisitMinutes} דק&apos; ביקור</span>}
                  {stop.rating != null && <span>⭐ {stop.rating}</span>}
                  <button
                    type="button"
                    onClick={() => handleSwapStop(stop.stopId)}
                    disabled={swappingStopId === stop.stopId}
                    className="mr-auto text-xs font-medium text-accent disabled:opacity-50"
                  >
                    {swappingStopId === stop.stopId ? "מחפש חלופה..." : "🔄 החלף"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {swapError && <p className="text-center text-sm text-danger">{swapError}</p>}

        {itinerary.events.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink">אירועים בסביבה השבוע</h2>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
   {itinerary.events.map((event) => (
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-48 shrink-0 overflow-hidden rounded-card bg-white shadow-soft"
                >
                  {event.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.imageUrl} alt={event.name} className="h-24 w-full object-cover" />
                  )}
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-ink">{event.name}</p>
                    {event.venueName && <p className="text-xs text-ink-secondary">{event.venueName}</p>}
                    {event.date && <p className="text-xs text-ink-secondary">{event.date}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <Link href="/home">
          <Button variant="primary" fullWidth>
            סיום
          </Button>
        </Link>
      </div>
    </Screen>
  );
}

export default function DayTripResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <DayTripResultContent />
    </Suspense>
  );
}