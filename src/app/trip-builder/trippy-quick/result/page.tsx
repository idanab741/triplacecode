"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen, Skeleton } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { ChatHeader } from "@/screens/trip-builder/chat/ChatHeader";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { downloadIcsFile } from "@/utils/downloadIcsFile";
import type { TrippyQuickStop } from "@/app/api/trip-builder/trippy-quick/route";
import type { FinalItineraryStop } from "@/services/tripBuilder/types";

/**
 * *** עמוד חדש (בקשה מפורשת - "מלל חופשי... משם ישר הולכים לעמוד
 * מסלול ייחודי שלא היה באפליקציה... עד 3 מסעדות ו-3 אטרקציות...
 * גרירה ומחיקה... הוספה ליומן... החיפוש על בסיס ה-API של קלוד").
 * *** תיקון עיצוב (בקשה מפורשת - "האם הסתכלת על האפליקציה שלנו???"):
 * - בר עליון: ChatHeader מקורי (לא בר משלי) - עקביות עם שאר עמודי טריפי.
 * - HERO: 100% רוחב, ישר מתחת לבר (בלי padding/gap) - לא בתוך ה-
 *   קונטיינר עם ה-padding הרגיל של Screen.
 * - סדר: HERO -> שם המסלול -> מפה -> כרטיסיות (בעיצוב SortableStopCard
 *   האמיתי - גרירה למעלה/למטה + סוויפ שמאלה למחיקה, לא כרטיס מותאם
 *   אישית) -> הוספה ליומן (בפופאפ, לא inline).
 * ר' src/app/api/trip-builder/trippy-quick/route.ts להסבר על מקור
 * הנתונים (Claude + אימות Google, בלי DB/session).
 */

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), { ssr: false });

/** ממיר TrippyQuickStop (השטוח, הפשוט) ל-FinalItineraryStop - הטיפוס
 *  ש-SortableStopCard (הכרטיס "האמיתי" של האפליקציה) מצפה לו. שדות
 *  שלא רלוונטיים לזרימה הזו (בלי session/AI-scheduling אמיתי) מקבלים
 *  ערכי ברירת מחדל ניטרליים (0/null) - לא נקראים בפועל על ידי
 *  SortableStopCard מלבד לתצוגה. */
function toFinalItineraryStop(stop: TrippyQuickStop, index: number): FinalItineraryStop {
  return {
    stopId: stop.id,
    placeId: stop.id,
    name: stop.name,
    category: stop.category,
    imageUrls: stop.imageUrl ? [stop.imageUrl] : [],
    etaMinutes: 0,
    arrivalOffsetMinutes: index * 90,
    estimatedVisitMinutes: 90,
    priceLevel: null,
    rating: stop.rating,
    reason: null,
    shortDescription: stop.shortDescription,
    latitude: stop.latitude,
    longitude: stop.longitude,
    openingHours: null,
    dayIndex: 0,
  };
}

function TrippyQuickResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const freeText = searchParams.get("freeText") ?? "";

  const [stops, setStops] = useState<TrippyQuickStop[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [addedToCalendar, setAddedToCalendar] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!freeText) {
      setError("לא התקבל מלל חופשי");
      return;
    }
    let cancelled = false;
    fetch("/api/trip-builder/trippy-quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeText }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data.stops) || data.stops.length === 0) {
          setError("לא הצלחנו למצוא מקומות מתאימים לבקשה הזו - נסו לנסח אחרת.");
          return;
        }
        setStops(data.stops);
        setTitle(typeof data.title === "string" ? data.title : null);
      })
      .catch(() => {
        if (!cancelled) setError("משהו השתבש - נסו שוב.");
      });
    return () => {
      cancelled = true;
    };
  }, [freeText]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !stops) return;
    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setStops(arrayMove(stops, oldIndex, newIndex));
  }

  function handleDelete(id: string) {
    setStops((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  }

  function handleConfirmAddToCalendar() {
    if (!stops || stops.length === 0) return;
    downloadIcsFile(stops, calendarDate, title ?? "מסלול-טריפי");
    setAddedToCalendar(true);
    setCalendarOpen(false);
  }

  const mapStops = (stops ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ stopId: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));

  return (
    <Screen withBottomNavSpacing>
      {/* *** תיקון (בקשה מפורשת - "הHERO צריך להיות על 100 אחוז!!"):
          אותה שיטה מוכחת ואמינה שכבר בשימוש בכל שאר האפליקציה (למשל
          ChatHeader.tsx דרך TrippyConversation.tsx) - במקום לנסות
          לאפס את ה-padding של Screen עצמו עם !important (עלול
          להתנגש/להיכשל בעדינות), פשוט "יוצאים" מהריווח הקבוע של
          Screen עם מרווח שלילי מדויק (-mx-5 -mt-8, בדיוק הערך של
          Screen: px-5 pt-8) - זו הדרך שכבר עובדת בפועל בכל מקום אחר
          בקוד, לא ניחוש חדש. */}
      <div className="-mx-5 -mt-8">
        <ChatHeader current={1} total={1} onBack={() => router.push("/ai")} />

        <div className="relative h-44 w-full">
          <Image src="/images/trippy-hero-calendar.png" alt="" fill className="object-cover" priority />
        </div>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 pt-4">
        {title && <h1 className="text-center text-lg font-bold text-ink">{title}</h1>}

        {error && (
          <div className="flex flex-col items-center gap-3 rounded-card bg-white p-6 text-center shadow-soft">
            <Image src="/images/tripy.png" alt="" width={56} height={56} className="rounded-full" />
            <p className="text-sm text-ink-secondary">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/ai")}
              className="rounded-pill px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              נסו שוב
            </button>
          </div>
        )}

        {!error && !stops && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
        )}

        {stops && stops.length > 0 && (
          <>
            {mapStops.length > 0 && <ResultMap stops={mapStops} />}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {stops.map((stop, index) => (
                    <SortableStopCard
                      key={stop.id}
                      stop={toFinalItineraryStop(stop, index)}
                      sessionId={null}
                      onItineraryUpdate={() => {}}
                      onDelete={() => handleDelete(stop.id)}
                      draggable={stops.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="w-full rounded-pill py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {addedToCalendar ? "✓ נוסף - הוספה שוב?" : "הוספה ליומן"}
            </button>
          </>
        )}
      </div>

      {/* פופאפ בחירת תאריך - לא inline בעמוד, לפי בקשה מפורשת */}
      {calendarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setCalendarOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-base font-bold text-ink">לאיזה תאריך?</p>
            <input
              type="date"
              value={calendarDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={handleConfirmAddToCalendar}
              className="mt-4 w-full rounded-pill py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              הוספה ליומן
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              className="mt-2 w-full py-2 text-sm text-ink-secondary"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      <MainBottomNav active="ai" />
    </Screen>
  );
}

export default function TrippyQuickResultPage() {
  return (
    <Suspense fallback={null}>
      <TrippyQuickResultContent />
    </Suspense>
  );
}
