"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { minutesToTimeLabel } from "@/utils/openingHours";
import { recalculateStopTimes } from "@/services/tripBuilder/reorderStops";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { LogisticsStopCard } from "@/screens/trip-builder/LogisticsStopCard";
import { HotelAutocomplete } from "@/screens/trip-builder/chat/HotelAutocomplete";
import type { FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function AbroadVacationResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayStartMinutes, setDayStartMinutes] = useState<Record<number, number>>({});
  const [editingTime, setEditingTime] = useState<number | null>(null);
 const [activeDayFilter, setActiveDayFilter] = useState<number | "all">("all");
  const [stopTimeOverrides, setStopTimeOverrides] = useState<Record<string, number>>({});
  const [editingStopId, setEditingStopId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hotelDraft, setHotelDraft] = useState<{ name: string; address: string }>({ name: "", address: "" });
  const [savingHotel, setSavingHotel] = useState(false);
  const [hotelSaved, setHotelSaved] = useState(false);
  const [editingHotel, setEditingHotel] = useState(false);
  const [logisticsImages, setLogisticsImages] = useState<Record<string, string | null>>({});
  const [airportInfo, setAirportInfo] = useState<{
    name: string;
    coords: { lat: number; lng: number };
    imageUrl: string | null;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleSaveHotel() {
    if (!sessionId || !hotelDraft.name || savingHotel) return;
    setSavingHotel(true);
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/hotel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hotelDraft.name, address: hotelDraft.address }),
      });
      if (!response.ok) throw new Error();
      setSession((s) =>
        s
          ? {
              ...s,
              answers: { ...(s.answers as object), hotels: [{ name: hotelDraft.name, address: hotelDraft.address }] },
            }
          : s
      );
      setHotelSaved(true);
      setEditingHotel(false);
    } catch {
      // שקט - לא חוסם את המשתמש
    } finally {
      setSavingHotel(false);
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

  /** שיתוף - מעדיף את ה-share sheet הטבעי של המכשיר (navigator.share) אם
   *  קיים; אחרת נופל ל-וואטסאפ ישירות. שיתוף PDF אמיתי (לא רק לינק) הוא
   *  פיצ'ר נפרד וגדול יותר - זה כרגע שיתוף קישור למסלול. */
  async function handleShareTrip() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `החופשה שלי ל${answersTyped?.destination ?? "היעד"} מוכנה! תראו את המסלול: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "המסלול שלי ב-TRIPLACE", text, url });
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

    // גרירה בין ימים: קודם היה DndContext נפרד לכל יום, כך שלא ניתן היה
    // בכלל לגרור תחנה מיום אחד לתוך יום אחר. עכשיו יש הקשר גרירה אחד משותף
    // לכל הימים - וכשתחנה "נוחתת" בין תחנות של יום אחר, מעדכנים את היום שלה
    // בפועל לפי השכנות החדשות (מעדיפים את היום של התחנה שלפניה; אם היא
    // ראשונה ברשימה - את היום של התחנה שאחריה).
    const movedStop = reordered[newIndex];
    const prevStop = reordered[newIndex - 1];
    const nextStop = reordered[newIndex + 1];
    const inferredDay = prevStop?.dayIndex ?? nextStop?.dayIndex ?? movedStop.dayIndex;
    if (inferredDay != null && inferredDay !== movedStop.dayIndex) {
      reordered[newIndex] = { ...movedStop, dayIndex: inferredDay };
    }

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

  /** משנה את שעת ההתחלה של יום שלם, ומאפסת כל דריסת-שעה ידנית שהוגדרה בעבר
   *  לתחנות של אותו יום - כדי שכולן יגזרו מחדש מהשעה החדשה, במקום שחלקן
   *  יישארו "תקועות" בזמן ישן שכבר לא תואם. */
  function handleDayStartChange(day: number, newMinutes: number, dayStopsForDay: FinalItinerary["stops"]) {
    setDayStartMinutes((s) => ({ ...s, [day]: newMinutes }));
    setStopTimeOverrides((s) => {
      const updated = { ...s };
      for (const stop of dayStopsForDay) delete updated[stop.stopId];
      return updated;
    });
  }

  /** משנה את השעה של תחנה ספציפית ביום. אם זו התחנה **הראשונה** ביום - זה
   *  שקול לשינוי שעת ההתחלה של כל היום. אחרת - מזיז את **כל התחנות שאחריה**
   *  באותו יום באותו הפרש בדיוק, כדי שהסדר הכרונולוגי יישאר הגיוני במקום
   *  שרק תחנה אחת "תזוז" והשאר יישארו עם שעות ישנות שלא מתעדכנות. */
  function handleStopTimeChange(day: number, dayStopsForDay: FinalItinerary["stops"], stopId: string, newMinutes: number) {
    const idx = dayStopsForDay.findIndex((s) => s.stopId === stopId);
    if (idx === -1) return;

    if (idx === 0) {
      handleDayStartChange(day, newMinutes - dayStopsForDay[0].arrivalOffsetMinutes, dayStopsForDay);
      return;
    }

    setStopTimeOverrides((s) => {
      const currentDisplay = s[stopId] ?? (dayStartMinutes[day] ?? 9 * 60) + dayStopsForDay[idx].arrivalOffsetMinutes;
      const delta = newMinutes - currentDisplay;
      const updated = { ...s };
      for (let i = idx; i < dayStopsForDay.length; i++) {
        const stop = dayStopsForDay[i];
        const displayForStop = s[stop.stopId] ?? (dayStartMinutes[day] ?? 9 * 60) + stop.arrivalOffsetMinutes;
        updated[stop.stopId] = displayForStop + delta;
      }
      return updated;
    });
  }

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
      // התצוגה כבר עודכנה אופטימית; אם השרת נכשל, המחיקה תישאר רק מקומית
      // עד לרענון הבא - עדיף מאשר לחסום את המשתמש עם שגיאה על פעולה כזו פשוטה
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.session) {
          setError("לא הצלחנו לטעון את החופשה");
          return;
        }
        setSession(data.session);
      })
      .catch(() => setError("לא הצלחנו לטעון את החופשה"));
  }, [sessionId]);

  const itinerary: FinalItinerary | null = session?.final_itinerary ?? null;

  useEffect(() => {
    if (!session) return;
    const destination = (session.answers as { destination?: string })?.destination;
    const hotel = (session.answers as { hotels?: { name: string; address: string }[] })?.hotels?.[0];

    if (destination && airportInfo === null) {
      fetch(`/api/places/airport-info?destination=${encodeURIComponent(destination)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.airport) {
            setAirportInfo({ name: data.airport.name, coords: data.airport.coords, imageUrl: data.airport.imageUrl });
          }
        })
        .catch(() => {});
    }
    if (hotel?.name && logisticsImages["hotel"] === undefined) {
      fetch(`/api/places/photo-search?q=${encodeURIComponent(`${hotel.name} ${hotel.address}`)}`)
        .then((res) => res.json())
        .then((data) => setLogisticsImages((s) => ({ ...s, hotel: data.imageUrl })))
        .catch(() => setLogisticsImages((s) => ({ ...s, hotel: null })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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
        <p className="pt-10 text-center text-ink-secondary">בונים את החופשה שלכם...</p>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא נבחרו מספיק תחנות כדי לבנות חופשה.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  const answersTyped = session.answers as {
    destination?: string;
    startDate?: string;
    endDate?: string;
    flights?: { flightNumber: string | null; departureTime: string; arrivalTime: string }[];
    hotels?: { name: string; address: string }[];
  };

  const dayGroups = injectLogisticsStops(groupStopsByDay(itinerary.stops), answersTyped, logisticsImages, airportInfo);
  const hasHotel = Boolean(answersTyped.hotels?.[0]?.name);

  const visibleDayGroups = dayGroups.filter(
    ({ day }) => activeDayFilter === "all" || day === activeDayFilter
  );
  const visibleStopsForMap = itinerary.stops.filter((s) => {
    if (activeDayFilter === "all") return true;
    const stopDay = (s as unknown as { dayIndex: number | null }).dayIndex ?? 1;
    return stopDay === activeDayFilter;
  });

  return (
    <Screen withBottomNavSpacing={true} className="!bg-bg !px-0 !pt-0">
      <div className="relative w-full">
        <Image
          src="/images/hero-abroad-vacation.png"
          alt="החופשה שלכם מוכנה"
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

        {/* שמור + שתף - בתוך תמונת ה-hero, בצד ימין, באותו גובה בדיוק כמו
            הלוגו. רקע לבן-שקוף (כמו אייקוני הפעמון/מיקום בעמוד הבית). */}
        <div className="absolute right-2 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveTrip}
            disabled={saving}
            aria-label="שמור חופשה"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/70 backdrop-blur-sm disabled:opacity-60"
          >
            {saved ? "✓" : <Image src="/icons/save.png" alt="" width={20} height={20} />}
          </button>
          <button
            type="button"
            onClick={handleShareTrip}
            aria-label="שתף חופשה"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/70 backdrop-blur-sm"
          >
            <Image src="/icons/share.png" alt="" width={24} height={24} style={{ transform: "translate(1px, 1px)" }} />
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-4">
        <div>
          <h1 className="text-xl font-bold text-ink">
            החופשה שלכם ל{answersTyped.destination ?? "היעד שבחרתם"} מוכנה!
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {itinerary.stops.length} תחנות
            {answersTyped.startDate && (
              <>
                {" · "}
                {formatDateRange(answersTyped.startDate, answersTyped.endDate!)}
              </>
            )}
          </p>
        </div>

        {/* הזמנת טיסה ומלון - placeholder בלבד לעכשיו, הפיצ'ר בפועל ייבנה בהמשך.
            עיצוב: הגרדיאנט של המותג עצמו (אותו אחד כמו כפתור "שמור חופשה") -
            כדי שזה ירגיש כמו קדימון פרימיום, לא תיבה אפורה גנרית. */}
        <div
          className="relative overflow-hidden rounded-card p-4 text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl backdrop-blur-sm">
                🛫
              </div>
              <div>
                <p className="text-[15px] font-bold">הזמנת טיסה ומלון</p>
                <p className="text-xs text-white/80">הכל במקום אחד, בקרוב</p>
              </div>
            </div>
            <span className="shrink-0 rounded-pill bg-white/25 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm">
              בקרוב
            </span>
          </div>
        </div>

        {/* בר הימים - מעל המפה, full-bleed. לוחצים כדי לסנן גם את המפה
            וגם את הרשימה למטה לאותו יום בלבד. */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
  <button
            type="button"
            onClick={() => setActiveDayFilter("all")}
            className={`flex shrink-0 flex-col items-center rounded-card px-4 py-2 shadow-soft ${
              activeDayFilter === "all" ? "bg-accent" : "bg-white"
            }`}
          >
            <span className={`text-xs font-bold ${activeDayFilter === "all" ? "text-white" : "text-accent"}`}>
              כל המסלול
            </span>
            {answersTyped.startDate && answersTyped.endDate && (
              <span className={`text-[10px] ${activeDayFilter === "all" ? "text-white/80" : "text-ink-secondary"}`}>
                {formatDateRange(answersTyped.startDate, answersTyped.endDate)}
              </span>
            )}
          </button>
          {dayGroups.map(({ day }) => (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDayFilter(day)}
              className={`flex shrink-0 flex-col items-center rounded-card px-4 py-2 shadow-soft ${
                activeDayFilter === day ? "bg-accent" : "bg-white"
              }`}
            >
              <span className={`text-xs font-bold ${activeDayFilter === day ? "text-white" : "text-accent"}`}>
                יום {day}
              </span>
              {answersTyped.startDate && (
                <span className={`text-[10px] ${activeDayFilter === day ? "text-white/80" : "text-ink-secondary"}`}>
                  {formatSingleDate(answersTyped.startDate, day - 1)}
                </span>
              )}
            </button>
          ))}
        </div>

        <ResultMap
          stops={visibleStopsForMap.map((s) => ({
            stopId: s.stopId,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
            dayIndex: (s as unknown as { dayIndex: number | null }).dayIndex,
          }))}
        />

        {(!hasHotel && !hotelSaved) || editingHotel ? (
          <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-md">
            <p className="text-sm font-semibold text-ink">איפה תישנו? (אופציונלי)</p>
            <p className="text-xs text-ink-secondary">
              הקלידו את שם המלון ובחרו מהרשימה שנפתחת - כדי שנדע את הכתובת המדויקת (חשוב לכפתור הזמנת הנסיעה).
            </p>
            <HotelAutocomplete
              name={hotelDraft.name}
              address={hotelDraft.address}
              onChange={(name, address) => setHotelDraft({ name, address })}
              destination={answersTyped.destination}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveHotel}
                disabled={!hotelDraft.name || savingHotel}
                className="mt-1 w-fit rounded-pill px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                {savingHotel ? "שומר..." : "שמרו מלון"}
              </button>
              {editingHotel && (
                <button
                  type="button"
                  onClick={() => setEditingHotel(false)}
                  className="mt-1 w-fit rounded-pill border border-ink-secondary/25 px-4 py-2 text-xs font-semibold text-ink-secondary"
                >
                  ביטול
                </button>
              )}
            </div>
          </div>
        ) : (
          hasHotel && (
            <div className="flex items-center justify-between rounded-card bg-white p-3.5 shadow-soft">
              <div>
                <p className="text-sm font-semibold text-ink">🏨 {answersTyped.hotels?.[0]?.name}</p>
                <p className="text-xs text-ink-secondary">
                  {answersTyped.hotels?.[0]?.address || "אין כתובת מדויקת - בחרו מהרשימה כדי שכפתור ההזמנה יעבוד"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHotelDraft({ name: answersTyped.hotels?.[0]?.name ?? "", address: answersTyped.hotels?.[0]?.address ?? "" });
                  setEditingHotel(true);
                }}
                className="shrink-0 rounded-pill border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent"
              >
                ערוך
              </button>
            </div>
          )
        )}

        {/* הקשר גרירה אחד משותף לכל הימים (לא אחד נפרד לכל יום) - זה מה
            שמאפשר לגרור תחנה מיום אחד לתוך יום אחר. items כולל את כל
            התחנות האמיתיות (לא הסינתטיות - נחיתה/מלון - שאינן ניתנות
            לגרירה/מחיקה ולא קיימות ב-itinerary.stops בכלל). */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visibleDayGroups.flatMap(({ stops }) => stops.filter((s) => !s.specialType).map((s) => s.stopId))}
            strategy={verticalListSortingStrategy}
          >
            {visibleDayGroups.map(({ day, stops: dayStops }) => (
              <div key={day} id={`day-${day}`} className="flex flex-col gap-3 scroll-mt-4">
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-ink">יום {day}</h2>
                    {answersTyped.startDate && (
                      <span className="text-xs text-ink-secondary">{formatSingleDate(answersTyped.startDate, day - 1)}</span>
                    )}
                  </div>
                  {editingTime === day ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={minutesToTimeLabel(dayStartMinutes[day] ?? 9 * 60)}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          if (!isNaN(h) && !isNaN(m)) handleDayStartChange(day, h * 60 + m, dayStops);
                        }}
                        autoFocus
                        className="w-24 rounded-pill border border-accent/30 bg-white px-2 py-1.5 text-sm font-semibold text-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingTime(null)}
                        className="rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        אישור
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTime(day)}
                      className="rounded-pill border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-semibold text-accent"
                    >
                      {minutesToTimeLabel(dayStartMinutes[day] ?? 9 * 60)}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {dayStops.map((stop) => {
                    const defaultMinutes = (dayStartMinutes[day] ?? 9 * 60) + stop.arrivalOffsetMinutes;
                    const displayMinutes = stopTimeOverrides[stop.stopId] ?? defaultMinutes;
                    if (stop.specialType) {
                      return (
                        <div key={stop.stopId} className="flex flex-col gap-1">
                          <span className="w-fit pr-1 text-sm font-bold text-accent">
                            🕐 {minutesToTimeLabel(displayMinutes)}
                          </span>
                          <LogisticsStopCard stop={stop} />
                        </div>
                      );
                    }
                    return (
                      <div key={stop.stopId} className="flex flex-col gap-1">
                        {editingStopId === stop.stopId ? (
                          <div className="flex w-fit items-center gap-1.5">
                            <input
                              type="time"
                              value={minutesToTimeLabel(displayMinutes)}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(":").map(Number);
                                if (!isNaN(h) && !isNaN(m)) {
                                  handleStopTimeChange(day, dayStops, stop.stopId, h * 60 + m);
                                }
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
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingStopId(stop.stopId)}
                            className="w-fit pr-1 text-sm font-bold text-accent"
                          >
                            🕐 {minutesToTimeLabel(displayMinutes)}
                          </button>
                        )}
                        <SortableStopCard
                          stop={stop}
                          sessionId={sessionId}
                          onItineraryUpdate={(updated) => setSession((s) => (s ? { ...s, final_itinerary: updated } : s))}
                          onDelete={() => handleDeleteStop(stop.stopId)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <MainBottomNav active="home" />
    </Screen>
  );
}

/** מציג טווח תאריכים בעברית, לדוגמה "12.8 - 15.8". */
function formatDateRange(startDate: string, endDate: string): string {
  const format = (d: string) => {
    const date = new Date(d);
    return `${date.getDate()}.${date.getMonth() + 1}`;
  };
  return `${format(startDate)} - ${format(endDate)}`;
}

/** מחזיר תאריך בודד בעברית, בתוספת מספר ימים מתאריך ההתחלה. */
function formatSingleDate(startDate: string, addDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + addDays);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/** מקבץ תחנות לפי dayIndex, ומחזיר מערך ממוין לפי מספר יום. תחנות בלי
 *  dayIndex (טיולים חד-יומיים ישנים) מקובצות תחת "יום 1" יחיד. */
function groupStopsByDay(
  stops: FinalItinerary["stops"]
): { day: number; stops: FinalItinerary["stops"] }[] {
  const groups = new Map<number, FinalItinerary["stops"]>();
  for (const stop of stops) {
    const day = (stop as unknown as { dayIndex: number | null }).dayIndex ?? 1;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(stop);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, dayStops]) => ({ day, stops: dayStops }));
}

/** יוצר תחנת-תצוגה מלאכותית (לא מ-DB) - נחיתה/צ'ק-אין/צ'ק-אאוט, בהתבסס
 *  על פרטי הטיסה/מלון שהמשתמש הזין בשאלון. */
function makeSyntheticStop(
  id: string,
  name: string,
  description: string,
  specialType: "landing" | "hotel_checkin" | "hotel_checkout" | "return_flight",
  offsetMinutes: number,
  imageUrl?: string | null,
  directionsUrl?: string | null
): FinalItinerary["stops"][number] {
  return {
    stopId: id,
    placeId: id,
    name,
    category: "logistics",
    imageUrls: imageUrl ? [imageUrl] : [],
    etaMinutes: 0,
    arrivalOffsetMinutes: offsetMinutes,
    estimatedVisitMinutes: 30,
    priceLevel: null,
    rating: null,
    reason: null,
    shortDescription: description,
    latitude: 0,
    longitude: 0,
    openingHours: null,
    dayIndex: null,
    specialType,
    directionsUrl: directionsUrl ?? null,
  };
}

/** בונה קישור ל-Google Maps עם מסלול נסיעה מוכן (origin -> destination) -
 *  המשתמש שבוחר לפתוח אותו רואה שם גם אפשרויות אובר/מונית/תחבורה ציבורית. */
function buildDirectionsUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
}

/** מוסיף שורות נחיתה/צ'ק-אין ליום הראשון, וצ'ק-אאוט + טיסת חזרה ליום האחרון -
 *  לפי פרטי הטיסה/מלון הראשונים שהמשתמש הזין (אם בכלל), ושם שדה התעופה
 *  האמיתי של היעד (אם אותר). */
function injectLogisticsStops(
  dayGroups: { day: number; stops: FinalItinerary["stops"] }[],
  answers: {
    flights?: { flightNumber: string | null; departureTime: string; arrivalTime: string }[];
    hotels?: { name: string; address: string }[];
  },
  images: Record<string, string | null>,
  airportInfo: { name: string; coords: { lat: number; lng: number }; imageUrl: string | null } | null
): { day: number; stops: FinalItinerary["stops"] }[] {
  if (dayGroups.length === 0) return dayGroups;

  const flight = answers.flights?.[0];
  const hotel = answers.hotels?.[0];
  const firstDay = dayGroups[0];
  const lastDay = dayGroups[dayGroups.length - 1];

  // שם שדה התעופה: אם אותר בפועל (airportInfo) - משתמשים בשם האמיתי, לא
  // בכותרת גנרית. אותו שדה תעופה בדיוק משמש גם לטיסת החזרה בסוף המסלול.
  const airportName = airportInfo?.name ?? "שדה התעופה";
  // מזהה מדויק לשדה התעופה בקישורי הניווט (קואורדינטות, לא רק שם טקסטואלי) -
  // מונע דו-משמעות אם יש כמה מקומות עם שם דומה.
  const airportPoint = airportInfo ? `${airportInfo.coords.lat},${airportInfo.coords.lng}` : airportName;

  const firstDayExtras: FinalItinerary["stops"] = [];
  firstDayExtras.push(
    makeSyntheticStop(
      "synthetic-landing",
      airportName,
      flight?.flightNumber
        ? `נחיתה בשדה התעופה (טיסה ${flight.flightNumber}), ולאחר מכן נסיעה למקום האירוח`
        : "נחיתה בשדה התעופה, ולאחר מכן נסיעה למקום האירוח",
      "landing",
      -60,
      airportInfo?.imageUrl ?? images.airport,
      hotel?.address ? buildDirectionsUrl(airportPoint, hotel.address) : null
    )
  );
  if (hotel?.name) {
    firstDayExtras.push(
      makeSyntheticStop(
        "synthetic-checkin",
        `הגעה למלון - ${hotel.name}`,
        hotel.address || "צ'ק-אין במלון",
        "hotel_checkin",
        -30,
        images.hotel
      )
    );
  }

  const updatedFirstDay = {
    ...firstDay,
    stops: [...firstDayExtras, ...firstDay.stops],
  };

  const lastDayExtras: FinalItinerary["stops"] = [];
  if (hotel?.name) {
    // עזיבת המלון - מתעדכן אוטומטית מהמלון שהוזן ביום הראשון (hotel.name
    // כאן הוא בדיוק אותו hotel כמו למעלה - אין הזנה כפולה). זהה לצ'ק-אין:
    // תמונת המלון + כפתור הזמנת נסיעה - אבל **לשדה התעופה** (לא חוזר על
    // כפתור ההלוך בטעות - זה מסלול הפוך: מהמלון לשדה התעופה).
    lastDayExtras.push(
      makeSyntheticStop(
        "synthetic-checkout",
        `צ'ק-אאוט מהמלון - ${hotel.name}`,
        hotel.address || "סיום השהייה",
        "hotel_checkout",
        24 * 60,
        images.hotel,
        hotel.address ? buildDirectionsUrl(hotel.address, airportPoint) : null
      )
    );
  }
  // טיסת חזרה - **אותו שדה תעופה בדיוק** של ההלוך, בסוף המסלול. בלי כפתור
  // הזמנת נסיעה משלה - זה כבר על כרטיס הצ'ק-אאוט שלפניה (אותה נסיעה בדיוק).
  lastDayExtras.push(
    makeSyntheticStop(
      "synthetic-return-flight",
      airportName,
      "טיסה חזרה מהיעד",
      "return_flight",
      24 * 60 + 60,
      airportInfo?.imageUrl ?? images.airport
    )
  );

  const isSameDay = firstDay.day === lastDay.day;
  const updatedLastDay = isSameDay
    ? { ...updatedFirstDay, stops: [...updatedFirstDay.stops, ...lastDayExtras] }
    : { ...lastDay, stops: [...lastDay.stops, ...lastDayExtras] };

  if (isSameDay) return [updatedLastDay, ...dayGroups.slice(1)];

  return [updatedFirstDay, ...dayGroups.slice(1, -1), updatedLastDay];
}

export default function AbroadVacationResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <AbroadVacationResultContent />
    </Suspense>
  );
}
