"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { SaveTripIconButton } from "@/screens/trip-builder/SaveTripIconButton";
import { AddToCalendarButton } from "@/screens/trip-builder/AddToCalendarButton";
import { MainBottomNav } from "@/components/MainBottomNav";
import { minutesToTimeLabel } from "@/utils/openingHours";
import { recalculateStopTimes } from "@/services/tripBuilder/reorderStops";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { LogisticsStopCard } from "@/screens/trip-builder/LogisticsStopCard";
import { LoadingGame } from "@/screens/trip-builder/LoadingGame";
import { resolveTripCalendarDate } from "@/utils/tripCalendarDate";
import type { FinalItinerary, TripBuilderSession, WeekendAnswers } from "@/services/tripBuilder/types";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function WeekendResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDayFilter, setActiveDayFilter] = useState<number | "all">("all");

  const [justShared, setJustShared] = useState(false);
  const [lodgingImage, setLodgingImage] = useState<string | null | undefined>(undefined);

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
    const text = `הסופ"ש שלי מוכן! תראו את המסלול: ${url}`;

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
            setError('לא הצלחנו לטעון את הסופ"ש');
            return;
          }
          setSession(data.session);
          if (data.session.status === "completed" && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        })
        .catch(() => {
          if (!cancelled) setError('לא הצלחנו לטעון את הסופ"ש');
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
  const answers = session?.answers as unknown as WeekendAnswers | undefined;

  // תיקון באג אמיתי (בקשה מפורשת - "למה הלינה שהזנתי לא מופיעה במסלול??
  // כמו שיש בחופשה בחו"ל?"): בחופשה בחו"ל יש מנגנון שלם שמזריק כרטיס
  // תצוגה סינתטי של המלון (injectLogisticsStops/makeSyntheticStop ב-
  // abroad-vacation/result/page.tsx) - בעמוד הזה הוא פשוט לא היה קיים
  // בכלל, אז גם כשהלינה כבר עגנה את המסלול נכון (התיקונים הקודמים) היא
  // מעולם לא הופיעה כתחנה בתצוגה עצמה. אותו עיקרון בדיוק, מותאם לסופ"ש
  // (בלי טיסה/שדה תעופה - רק כרטיס לינה אחד ביום 1).
  useEffect(() => {
    const lodgingName = answers?.lodgingName;
    const lodgingAddress = answers?.lodgingAddress;
    if (!lodgingName || lodgingImage !== undefined) return;
    fetch(`/api/places/photo-search?q=${encodeURIComponent(`${lodgingName} ${lodgingAddress ?? ""}`.trim())}`)
      .then((res) => res.json())
      .then((data) => setLodgingImage(data.imageUrl ?? null))
      .catch(() => setLodgingImage(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers?.lodgingName, answers?.lodgingAddress]);

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

  if (session.status !== "completed") {
    // תיקון באג אמיתי (בקשה מפורשת - "המשחק עדיין מועבר באופן אוטומטי!!
    // ביקשתי שיופיע רק אם לוחצים על הלוגו שלו בעמוד הצ'אט"): קודם עמוד
    // התוצאה הציג את המשחק המלא-מסך (LoadingGame) לכל מי שהגיע לכאן
    // כשה-session עדיין לא completed - בלי שום קשר לשאלה אם המשתמש בכלל
    // ביקש לשחק. גם הנתיב האוטומטי (המתנה בצ'אט, בלי לחיצה) יכול להגיע
    // לכאן לפני שהבנייה הסתיימה (למשל אם היא לוקחת יותר מ-20 שניות) -
    // ואז המשחק "קפץ" בלי שום לחיצה. game=1 מגיע ב-URL אך ורק מהנתיב
    // שבו המשתמש לחץ בפועל על בועת ה-runtrippy (ר' buildTripDirectly ב-
    // weekend/page.tsx) - זה הסימן היחיד שמבדיל בין שני הנתיבים כאן.
    // בלי game=1 - מסך המתנה רגיל, לא אינטראקטיבי, כשה-polling הקיים
    // (useEffect למעלה, לא תלוי בתצוגה) ממשיך וינווט/ירנדר מחדש ברגע שה-
    // session מוכן.
    const wantsGame = searchParams.get("game") === "1";

    if (wantsGame) {
      return (
        <LoadingGame
          statusText='רגע, בונים לכם את הסופ"ש...'
          steps={[
            "🏡 מוצאים את אזור הלינה המושלם",
            "🏛️ בוחרים אטרקציות ופינות מיוחדות",
            "🍽️ מתאימים מסעדות לכל יום",
            "🗺️ בונים מסלול לפי אזורים וזמני נסיעה",
            "⏱️ מסדרים הכל לפי שעות פתיחה וקצב הטיול",
          ]}
        />
      );
    }

    return (
      <Screen>
        <div className="flex flex-col items-center justify-center gap-4 pt-24 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/25 border-t-accent" />
          <p className="text-sm font-medium text-ink-secondary">רגע, בונים לכם את הסופ&quot;ש...</p>
        </div>
      </Screen>
    );
  }

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא נבחרו מספיק תחנות כדי לבנות סופ&quot;ש.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  const rawDayGroups = groupStopsByDay(itinerary.stops);
  const dayGroups = injectLodgingStop(
    rawDayGroups,
    { lodgingName: answers?.lodgingName ?? null, lodgingAddress: answers?.lodgingAddress ?? null, hasBookedLodging: answers?.hasBookedLodging ?? false },
    lodgingImage ?? null
  );
  const visibleDayGroups = dayGroups.filter(({ day }) => activeDayFilter === "all" || day === activeDayFilter);
  const visibleStopsForMap = itinerary.stops.filter((s) => {
    if (activeDayFilter === "all") return true;
    const stopDay = (s as unknown as { dayIndex: number | null }).dayIndex ?? 1;
    return stopDay === activeDayFilter;
  });

  return (
    <Screen withBottomNavSpacing={true} className="!bg-bg !px-0 !pt-0">
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
              aria-label="שתף מסלול"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
            >
              <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative w-full">
        <Image
          src="/images/hero-weekend.png"
          alt='הסופ"ש שלכם מוכן'
          width={800}
          height={450}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-10 pt-4">
        <div>
          <h1 className="text-xl font-bold text-ink">הסופ&quot;ש שלכם מוכן!</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {itinerary.stops.length} תחנות
            {answers?.startDate && answers?.endDate ? ` · ${formatDateRange(answers.startDate, answers.endDate)}` : ""}
          </p>
        </div>

        {/* בר הימים - לוחצים כדי לסנן גם את המפה וגם את הרשימה למטה לאותו יום בלבד. */}
        {dayGroups.length > 1 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
            <button
              type="button"
              onClick={() => setActiveDayFilter("all")}
              className={`shrink-0 rounded-card px-4 py-2 text-xs font-bold shadow-soft ${
                activeDayFilter === "all" ? "bg-accent text-white" : "bg-white text-accent"
              }`}
            >
              כל המסלול
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
                {answers?.startDate && (
                  <span className={`text-[10px] ${activeDayFilter === day ? "text-white/80" : "text-ink-secondary"}`}>
                    {formatSingleDate(answers.startDate, day - 1)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <ResultMap
          stops={visibleStopsForMap.map((s) => ({
            stopId: s.stopId,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
          }))}
        />

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={itinerary.stops.map((s) => s.stopId)} strategy={verticalListSortingStrategy}>
            {visibleDayGroups.map(({ day, stops: dayStops }) => (
              <div key={day} className="flex flex-col gap-3">
                {dayGroups.length > 1 && activeDayFilter === "all" && (
                  <h2 className="mt-2 text-sm font-bold text-ink">יום {day}</h2>
                )}
                {dayStops.map((stop) => {
                  if (stop.specialType) {
                    return (
                      <div key={stop.stopId} className="flex flex-col gap-1">
                        <p className="pr-1 text-sm font-bold text-accent">
                          🕐 {minutesToTimeLabel(9 * 60 + stop.arrivalOffsetMinutes)}
                        </p>
                        <LogisticsStopCard stop={stop} />
                      </div>
                    );
                  }
                  return (
                    <div key={stop.stopId} className="flex flex-col gap-1">
                      <p className="pr-1 text-sm font-bold text-accent">
                        🕐 {minutesToTimeLabel(9 * 60 + stop.arrivalOffsetMinutes)}
                      </p>
                      <SortableStopCard
                        stop={stop}
                        sessionId={sessionId}
                        onItineraryUpdate={(updated) => setSession((s) => (s ? { ...s, final_itinerary: updated } : s))}
                        draggable={itinerary.stops.length >= 2}
                        onDelete={itinerary.stops.length >= 2 ? () => handleDeleteStop(stop.stopId) : undefined}
                        placeHref={`/place/${stop.placeId}?from=ai`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <AddToCalendarButton sessionId={sessionId} date={resolveTripCalendarDate(session?.answers)} />
      </div>

      <MainBottomNav active="home" />
    </Screen>
  );
}

/** מחזיר טווח תאריכים בעברית, בפורמט "5.8 - 7.8". */
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

/** מקבץ תחנות לפי dayIndex, ומחזיר מערך ממוין לפי מספר יום. */
function groupStopsByDay(stops: FinalItinerary["stops"]): { day: number; stops: FinalItinerary["stops"] }[] {
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

/** בונה קישור ל-Google Maps עם מסלול נסיעה מוכן (origin -> destination). */
function buildDirectionsUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
}

/** יוצר תחנת-תצוגה מלאכותית (לא מ-DB) - צ'ק-אין בלינה - בהתבסס על מה
 *  שהמשתמש הזין בשאלון. אותו עיקרון בדיוק כמו makeSyntheticStop בחופשה
 *  בחו"ל, בלי טיסה/שדה תעופה (סופ"ש הוא תמיד בארץ). */
function makeLodgingStop(
  id: string,
  name: string,
  description: string,
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
    specialType: "hotel_checkin",
    directionsUrl: directionsUrl ?? null,
  };
}

/**
 * תיקון באג אמיתי (בקשה מפורשת - "למה הלינה שהזנתי לא מופיעה במסלול??
 * כמו שיש בחופשה בחו"ל? אמורה להופיע ביום הראשון, מיד אחרי האטרקציה
 * הראשונה"): מזריק כרטיס לינה סינתטי (לא תחנת DB אמיתית) ליום 1, מיד
 * אחרי התחנה הראשונה - לא לפניה (בניגוד לחו"ל, שם הצ'ק-אין קודם לכל
 * דבר אחר, מיד אחרי הנחיתה בשדה התעופה). אם אין עדיין תחנה אחת ביום 1
 * בכלל, לא מוסיפים כלום (אין "אחרי הראשונה" להתייחס אליו).
 */
function injectLodgingStop(
  dayGroups: { day: number; stops: FinalItinerary["stops"] }[],
  answers: { lodgingName: string | null; lodgingAddress: string | null; hasBookedLodging: boolean },
  lodgingImage: string | null
): { day: number; stops: FinalItinerary["stops"] }[] {
  if (!answers.hasBookedLodging || !answers.lodgingName) return dayGroups;
  if (dayGroups.length === 0) return dayGroups;

  const firstDay = dayGroups[0];
  if (firstDay.stops.length === 0) return dayGroups;

  const firstStop = firstDay.stops[0];
  const secondStop = firstDay.stops[1];
  // ממקמים בין התחנה הראשונה לשנייה (אם יש) - כדי שהשעה המוצגת תהיה
  // הגיונית ("בין" שתי התחנות האמיתיות), לא תמיד +30 דק' קבוע שעלול
  // להתנגש עם שעת התחנה הבאה בפועל.
  const checkinOffset = secondStop
    ? Math.round((firstStop.arrivalOffsetMinutes + secondStop.arrivalOffsetMinutes) / 2)
    : firstStop.arrivalOffsetMinutes + 30;

  const checkinStop = makeLodgingStop(
    "synthetic-lodging-checkin",
    `הגעה ללינה - ${answers.lodgingName}`,
    answers.lodgingAddress || "צ'ק-אין",
    checkinOffset,
    lodgingImage,
    answers.lodgingAddress && firstStop.latitude && firstStop.longitude
      ? buildDirectionsUrl(`${firstStop.latitude},${firstStop.longitude}`, answers.lodgingAddress)
      : null
  );

  const updatedFirstDay = {
    ...firstDay,
    stops: [firstStop, checkinStop, ...firstDay.stops.slice(1)],
  };

  return [updatedFirstDay, ...dayGroups.slice(1)];
}

export default function WeekendResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <WeekendResultContent />
    </Suspense>
  );
}
