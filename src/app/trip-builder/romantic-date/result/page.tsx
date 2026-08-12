"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { minutesToTimeLabel } from "@/utils/openingHours";
import { recalculateStopTimes } from "@/services/tripBuilder/reorderStops";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import type { FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function RomanticDateResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualStartMinutes, setManualStartMinutes] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  async function handleShareTrip() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `הדייט שלי מוכן! תראו את המסלול: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "הדייט שלי ב-TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל את ה-share sheet, או שהוא לא נתמך בפועל - נופלים לוואטסאפ
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

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
          setError("לא הצלחנו לטעון את הדייט");
          return;
        }
        setSession(data.session);
      })
      .catch(() => setError("לא הצלחנו לטעון את הדייט"));
  }, [sessionId]);

  const itinerary: FinalItinerary | null = session?.final_itinerary ?? null;

  const defaultStartMinutes = 19 * 60; // ברירת מחדל - 19:00, סביר יותר לדייט ערב מ-9:00 של טיול יומי

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
        <p className="pt-10 text-center text-ink-secondary">בונים את הדייט שלכם...</p>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא נבחרו מספיק תחנות כדי לבנות דייט.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
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
            <button
              type="button"
              onClick={handleSaveTrip}
              disabled={saving}
              aria-label="שמור דייט"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink disabled:opacity-60"
            >
              {saved ? "✓" : <Image src="/icons/save.png" alt="" width={26} height={26} />}
            </button>
            <button
              type="button"
              onClick={handleShareTrip}
              aria-label="שתף דייט"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
            >
              <Image src="/icons/share.png" alt="" width={26} height={26} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative w-full">
        <Image
          src="/images/hero-romantic-date.png"
          alt="הדייט שלכם מוכן"
          width={800}
          height={450}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">הדייט שלכם מוכן!</h1>
            <p className="mt-1 text-sm text-ink-secondary">{itinerary.stops.length} תחנות</p>
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
          <SortableContext items={itinerary.stops.map((s) => s.stopId)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {itinerary.stops.map((stop) => (
                <div key={stop.stopId} className="flex flex-col gap-1">
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
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={handleSaveTrip}
          disabled={saving}
          className="w-full rounded-pill py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {saving ? "שומר..." : saved ? "✓ הדייט נשמר" : "שמור דייט"}
        </button>
      </div>
    </Screen>
  );
}

export default function RomanticDateResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <RomanticDateResultContent />
    </Suspense>
  );
}
