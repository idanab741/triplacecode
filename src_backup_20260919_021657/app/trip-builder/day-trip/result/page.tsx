"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, Screen } from "@/components/ui";
import { AddToCalendarButton } from "@/screens/trip-builder/AddToCalendarButton";
import { SaveTripIconButton } from "@/screens/trip-builder/SaveTripIconButton";
import { TripHeroHeader, LIGHT_AREA_ICON_STYLE } from "@/screens/layout/TripHeroHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { resolveTripCalendarDate } from "@/utils/tripCalendarDate";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getTripDayOfWeek, minutesToTimeLabel, parseOpeningHoursForDay } from "@/utils/openingHours";
import { recalculateStopTimes } from "@/services/tripBuilder/reorderStops";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { LoadingGame } from "@/screens/trip-builder/LoadingGame";
import type { DayTripAnswers, FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function DayTripResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualStartMinutes, setManualStartMinutes] = useState<number | null>(null);
  // בקשה מפורשת ("למה לא הורדת את השעון? סימון אוטומטי כמו בחופשה בחו"ל") -
  // אותו דפוס בדיוק כמו עמוד התוצאה של חופשה בחו"ל: בלי override ידני,
  // לא מציגים שעה מחושבת אוטומטית בכלל - רק כפתור "+ הוסף שעה".
  const [stopTimeOverrides, setStopTimeOverrides] = useState<Record<string, number>>({});
  const [editingStopId, setEditingStopId] = useState<string | null>(null);

  function handleStopTimeChange(stopId: string, minutes: number) {
    setStopTimeOverrides((prev) => ({ ...prev, [stopId]: minutes }));
    const itinerary = session?.final_itinerary;
    if (sessionId && itinerary) {
      fetch(`/api/trip-builder/sessions/${sessionId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary }),
      }).catch(() => {});
    }
  }
  const [editingTime, setEditingTime] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [swappingStopId, setSwappingStopId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  async function handleDeleteStop(stopId: string) {
    if (!sessionId || !session?.final_itinerary) return;

    const remainingStops = session.final_itinerary.stops.filter((s) => s.stopId !== stopId);
    setSession((s) => (s ? { ...s, final_itinerary: { ...s.final_itinerary!, stops: remainingStops } } : s));

    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/stops/${stopId}/instruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.itinerary) {
        setSession((s) => (s ? { ...s, final_itinerary: data.itinerary } : s));
      }
    } catch {
      // עדכון אופטימי כבר קרה
    }
  }

  async function handleShareTrip() {
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `הטיול היומי שלי מוכן! תראו את המסלול: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "המסלול שלי ב-TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function fetchOnce() {
      fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.session) {
            setError("לא הצלחנו לטעון את הטיול");
            return;
          }
          setSession(data.session);
          if (data.session.status === "completed" && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        })
        .catch(() => {
          if (!cancelled) setError("לא הצלחנו לטעון את הטיול");
        });
    }

    fetchOnce();
    intervalId = setInterval(fetchOnce, 2500);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId]);
  const itinerary: FinalItinerary | null = session?.final_itinerary ?? null;
  const answers = session?.answers as unknown as DayTripAnswers | undefined;

  const defaultStartMinutes = useMemo(() => {
    if (!itinerary || !answers || itinerary.stops.length === 0) return 9 * 60;
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
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    if (session.status !== "completed") {
      // בקשה מפורשת: אחרי שהניווט האוטומטי בוטל (ר' day-trip/page.tsx),
      // המצב הזה מגיע אך ורק מלחיצה יזומה של המשתמש על בועת ה-runtrippy
      // בצ'אט ("בואו נצא לדרך!") - כלומר המשתמש בחר במפורש "להיכנס למשחק".
      // לכן כאן, ורק כאן, מציגים את מסך המשחק האינטראקטיבי (LoadingGame)
      // בפועל - לא את המסך הסטטי (BuildingTripIntro), שנשאר רק כרשת ביטחון
      // ל-edge case שבו אין session בכלל (ר' מעלה, "if (!session)"). התשאול
      // (polling, כל 2.5 שניות, כבר קיים למעלה) ימשיך וידליק את התוצאה
      // האמיתית ברגע שהיא מוכנה, בלי שהמשתמש יצטרך לעשות כלום.
      return (
        <LoadingGame
          statusText="רגע, בונים לכם את הטיול..."
          steps={["🔍 סורקים אטרקציות ומקומות באזור שלכם", "📍 בודקים מרחק וזמן הגעה", "⭐ מסננים לפי דירוג והתאמה", "🗺️ בונים את המסלול המושלם"]}
        />
      );
    }
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
    <Screen withBottomNavSpacing={true} className="!bg-white !px-0 !pt-0">
      <TripHeroHeader
        heroSrc="/images/hero-day-trip-result.png"
        heroAlt="הטיול שלכם מוכן"
        onBack={() => router.push("/home")}
        rightSlot={
          <>
            <SaveTripIconButton sessionId={sessionId} iconClassName={LIGHT_AREA_ICON_STYLE} />
            <button
              type="button"
              onClick={handleShareTrip}
              aria-label="שתף טיול"
              className="flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Image
                src={justShared ? "/icons/share-active.png" : "/icons/share.png"}
                alt=""
                width={26}
                height={26}
                className={LIGHT_AREA_ICON_STYLE}
              />
            </button>
          </>
        }
      />

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-0">
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
              {itinerary.stops.map((stop) => {
                const defaultMinutes = startMinutes + stop.arrivalOffsetMinutes;
                const displayMinutes = stopTimeOverrides[stop.stopId] ?? defaultMinutes;
                return (
                  <div key={stop.stopId} className="flex flex-col gap-1">
                    {editingStopId === stop.stopId ? (
                      <div className="flex w-fit items-center gap-1.5">
                        <input
                          type="time"
                          value={minutesToTimeLabel(displayMinutes)}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(":").map(Number);
                            if (!isNaN(h) && !isNaN(m)) handleStopTimeChange(stop.stopId, h * 60 + m);
                          }}
                          autoFocus
                          className="w-24 rounded-pill border border-accent/30 bg-white px-2 py-1 text-sm font-bold text-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingStopId(null)}
                          className="rounded-pill bg-accent px-2 py-1 text-[10px] font-semibold text-white"
                        >
                          אישור
                        </button>
                      </div>
                    ) : stopTimeOverrides[stop.stopId] !== undefined ? (
                      <button
                        type="button"
                        onClick={() => setEditingStopId(stop.stopId)}
                        className="w-fit pr-1 text-sm font-bold text-accent"
                      >
                        🕐 {minutesToTimeLabel(displayMinutes)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingStopId(stop.stopId)}
                        className="w-fit rounded-pill border border-dashed border-ink-secondary/30 px-2 py-0.5 text-xs text-ink-secondary"
                      >
                        + הוסף שעה
                      </button>
                    )}
                    <SortableStopCard
                    stop={stop}
                    sessionId={sessionId}
                    onItineraryUpdate={(updated) =>
                      setSession((s) => (s ? { ...s, final_itinerary: updated } : s))
                    }
                    // גרירה+מחיקה רק כשיש יותר מ-2 תחנות - לגרירה/מחיקה
                    // במסלול עם תחנה אחת/שתיים אין משמעות אמיתית (אין
                    // לאן לסדר מחדש, ומחיקה עלולה להשאיר מסלול ריק).
                    // "שינוי עם TRIPPY" נשאר תמיד זמין - זו לא ר' לגרירה.
                    draggable={itinerary.stops.length >= 2}
                    onDelete={itinerary.stops.length >= 2 ? () => handleDeleteStop(stop.stopId) : undefined}
                    placeHref={`/place/${stop.placeId}?from=ai`}
                  />
                  </div>
                );
              })}
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

        <AddToCalendarButton sessionId={sessionId} date={resolveTripCalendarDate(session?.answers)} />
      </div>

      <MainBottomNav active="home" />
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