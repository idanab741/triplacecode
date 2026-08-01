"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { minutesToTimeLabel } from "@/utils/openingHours";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
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

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      {/* Hero עליון עם הלוגו בפינה - זהה לעמוד תוצאות הטיול היומי */}
      <div className="relative w-full">
        <Image
          src="/images/hero-restaurants-cafes.png"
          alt=""
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
              />
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
          {saving ? "שומר..." : saved ? "✓ המקום נשמר" : "שמור מקום"}
        </button>
      </div>
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