"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { SaveTripIconButton } from "@/screens/trip-builder/SaveTripIconButton";
import { AddToCalendarButton } from "@/screens/trip-builder/AddToCalendarButton";
import { MainBottomNav } from "@/components/MainBottomNav";
import { minutesToTimeLabel } from "@/utils/openingHours";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { resolveTripCalendarDate } from "@/utils/tripCalendarDate";
import type { TripBuilderSession } from "@/services/tripBuilder/types";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function RestaurantResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualStartMinutes, setManualStartMinutes] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState(false);

  const [justShared, setJustShared] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDeleteStop(stopId: string) {
    if (!sessionId || !session?.final_itinerary) return;

    // עדכון אופטימי - מוחקים מהתצוגה מיד, בלי לחכות לשרת
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
      // עדכון אופטימי כבר קרה - לא הופכים אותו אם השרת נכשל בשקט, רק לא מסנכרנים חזרה
    }
  }

  async function handleShareTrip() {
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `המקום שמצאתי לי מוכן! תראו את המסלול: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "המקום שמצאתי ב-TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל את ה-share sheet, או שהוא לא נתמך בפועל - נופלים לוואטסאפ
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.session) {
          setError("לא הצלחנו לטעון את המקום");
          return;
        }
        setSession(data.session);
      })
      .catch(() => setError("לא הצלחנו לטעון את המקום"));
  }, [sessionId]);

  const itinerary = session?.final_itinerary ?? null;

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
        <p className="pt-10 text-center text-ink-secondary">מוצאים לכם את המקום המושלם...</p>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא מצאנו מקום מתאים כרגע, נסו שוב.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  const stop = itinerary.stops[0];
  const defaultStartMinutes = 9 * 60; // ברירת מחדל - בהיעדר עוגן שעת פתיחה כמו בטיול היומי
  const startMinutes = manualStartMinutes ?? defaultStartMinutes;

  return (
    <Screen withBottomNavSpacing={true} className="!bg-bg !px-0 !pt-0">
      {/* Hero עליון עם הלוגו בפינה - זהה לעמוד תוצאות הטיול היומי */}
            <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
        <div className="relative h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
            <Link
              href="/home"
              className="flex h-10 w-10 shrink-0 items-center justify-center text-ink"
              aria-label="חזרה לדף הבית"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </Link>
          </div>

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <SaveTripIconButton sessionId={sessionId} />
            <button
              type="button"
              onClick={handleShareTrip}
              aria-label="שתף מקום"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
            >
              <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative w-full">
        <Image
          src="/images/hero-restaurants-cafes.png"
          alt=""
          width={800}
          height={450}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">מצאנו את המקום בשבילכם!</h1>
            <p className="mt-1 text-sm text-ink-secondary">מקום אחד מדויק</p>
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

        {/* מפה עם נקודה אחת - עקבי עם עיצוב הטיול היומי */}
        <ResultMap
          stops={[{ stopId: stop.stopId, name: stop.name, latitude: stop.latitude, longitude: stop.longitude }]}
        />

        <DndContext sensors={sensors}>
          <SortableContext items={[stop.stopId]} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1">
              <p className="pr-1 text-sm font-bold text-accent">
                🕐 {minutesToTimeLabel(startMinutes + stop.arrivalOffsetMinutes)}
              </p>
              <SortableStopCard
                stop={stop}
                sessionId={sessionId}
                onItineraryUpdate={(updated) => setSession((s) => (s ? { ...s, final_itinerary: updated } : s))}
                onDelete={() => handleDeleteStop(stop.stopId)}
              />
            </div>
          </SortableContext>
        </DndContext>

        <AddToCalendarButton sessionId={sessionId} date={resolveTripCalendarDate(session?.answers)} />
      </div>

      <MainBottomNav active="home" />
    </Screen>
  );
}

export default function RestaurantResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <RestaurantResultContent />
    </Suspense>
  );
}