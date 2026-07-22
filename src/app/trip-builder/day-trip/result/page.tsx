"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, Screen } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getTripDayOfWeek, minutesToTimeLabel, parseOpeningHoursForDay } from "@/utils/openingHours";
import { recalculateStopTimes } from "@/services/tripBuilder/reorderStops";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
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

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSaveTrip() {
    if (!sessionId || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/save`, { method: "POST" });
      if (!response.ok) throw new Error();
      setSaved(true);
    } catch {
      // שקט - לא חוסם את המשתמש אם השמירה נכשלת
    } finally {
      setSaving(false);
    }
  }

  
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

const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const itinerary = session?.final_itinerary;
    if (!session || !itinerary || !event.over || event.active.id === event.over.id) return;

    const oldIndex = itinerary.stops.findIndex((s) => s.stopId === event.active.id);
    const newIndex = itinerary.stops.findIndex((s) => s.stopId === event.over!.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(itinerary.stops, oldIndex, newIndex);
    const recalculated = recalculateStopTimes(reordered, {
      lat: session.origin_latitude!,
      lng: session.origin_longitude!,
    });

    const updatedItinerary = { ...itinerary, stops: recalculated };
    setSession((s) => (s ? { ...s, final_itinerary: updatedItinerary } : s));

    if (sessionId) {
      fetch(`/api/trip-builder/sessions/${sessionId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary: updatedItinerary }),
      }).catch(() => {});
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
<div className="absolute left-2 top-4 flex items-center gap-2">
            <Image src="/images/trip-triplace-logo.png" alt="" width={130} height={40} className="object-contain" />
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
</div>

<div className="mx-auto flex max-w-sm flex-col gap-5 px-5 pb-10 pt-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">הטיול שלכם מוכן!</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {itinerary.stops.length} תחנות{session?.trip_intent?.requestedArea ? ` · ${session.trip_intent.requestedArea}` : ""}
            </p>
          </div>
          <div className="shrink-0">
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
                className="w-20 rounded-pill border border-accent/30 px-2 py-1.5 text-sm font-semibold"
              />
            ) : (
<button
                type="button"
                onClick={() => setEditingTime(true)}
                className="rounded-pill border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-semibold text-accent"
              >
                {minutesToTimeLabel(startMinutes)}
              </button>
            )}
          </div>
        </div>

{/* מפה אינטראקטיבית - Leaflet + OpenStreetMap, חינמי לגמרי */}
        <ResultMap
          stops={itinerary.stops.map((s) => ({
            stopId: s.stopId,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
          }))}
        />

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={itinerary.stops.map((s) => s.stopId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
{itinerary.stops.map((stop) => (
                <div key={stop.stopId} className="flex flex-col gap-1">
                  <p className="pr-1 text-sm font-bold text-accent">
                    🕐 {minutesToTimeLabel(startMinutes + stop.arrivalOffsetMinutes)}
                  </p>
                  <SortableStopCard
                    stop={stop}
                    sessionId={sessionId}
                    onItineraryUpdate={(updated) =>
                      setSession((s) => (s ? { ...s, final_itinerary: updated } : s))
                    }
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

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

<button
          type="button"
          onClick={handleSaveTrip}
          disabled={saving}
          className="w-full rounded-pill py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {saving ? "שומר..." : saved ? "✓ המסלול נשמר" : "שמור מסלול"}
        </button>
      
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