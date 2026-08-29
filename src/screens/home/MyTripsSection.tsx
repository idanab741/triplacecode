"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Skeleton, SwipeUpToDeleteCard } from "@/components/ui";

/**
 * *** תיקון אדריכלי (ר' migration 0057 - trippy_ai_results): עד עכשיו
 * "הטיולים שלי" שלף רק מ-trip_builder_sessions (טיולי יום/חופשה
 * מהאשף המלא). עכשיו מאחד שני מקורות **נפרדים לגמרי**: הטבלה הישנה
 * (via /api/trip-builder/sessions/saved) + הטבלה החדשה הייעודית
 * לצ'אט המהיר (via /api/trippy-ai) - לא מערבבים אותן ב-DB, רק
 * בתצוגה, וכל כרטיס "trippy AI" מסומן בבירור (תג עם הגלובוס המהבהב -
 * אותו רכיב/אנימציה בדיוק כמו כפתור "trippy AI" בתפריט התחתון).
 */
interface TripPreview {
  id: string;
  tripType: string | null;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  isTrippyAi: boolean;
  shareToken?: string;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(trip: TripPreview): string {
  if (trip.isTrippyAi) return `/trip-builder/trippy-quick/result?savedId=${trip.id}`;
  const routeSegment = TRIP_TYPE_ROUTE[trip.tripType ?? ""] ?? (trip.tripType ?? "day-trip").replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${trip.id}`;
}

function deleteTripPath(trip: TripPreview): string {
  return trip.isTrippyAi ? `/api/trippy-ai/${trip.id}` : `/api/trip-builder/sessions/${trip.id}`;
}

const PREVIEW_LIMIT = 10;

export function MyTripsSection() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripPreview[] | null>(null);
  const [emblaRef] = useEmblaCarousel({
    direction: "rtl",
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/trip-builder/sessions/saved?all=true&limit=${PREVIEW_LIMIT}`)
        .then((res) => res.json())
        .catch(() => ({ trips: [] })),
      fetch(`/api/trippy-ai?limit=${PREVIEW_LIMIT}`)
        .then((res) => res.json())
        .catch(() => ({ results: [] })),
    ]).then(([sessionsData, trippyAiData]) => {
      const fromSessions: TripPreview[] = (sessionsData.trips ?? []).map(
        (t: { sessionId: string; tripType: string; destinationLabel: string; imageUrl: string | null; stopCount: number; createdAt: string }) => ({
          id: t.sessionId,
          tripType: t.tripType,
          destinationLabel: t.destinationLabel,
          imageUrl: t.imageUrl,
          stopCount: t.stopCount,
          createdAt: t.createdAt,
          isTrippyAi: false,
        })
      );
      const fromTrippyAi: TripPreview[] = (trippyAiData.results ?? []).map(
        (r: { id: string; title: string; imageUrl: string | null; stopCount: number; createdAt: string; shareToken: string }) => ({
          id: r.id,
          tripType: null,
          destinationLabel: r.title,
          imageUrl: r.imageUrl,
          stopCount: r.stopCount,
          createdAt: r.createdAt,
          isTrippyAi: true,
          shareToken: r.shareToken,
        })
      );
      const merged = [...fromSessions, ...fromTrippyAi].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTrips(merged.slice(0, PREVIEW_LIMIT));
    });
  }, []);

  async function handleDeleteTrip(trip: TripPreview) {
    setTrips((prev) => (prev ? prev.filter((t) => t.id !== trip.id) : prev));
    await fetch(deleteTripPath(trip), { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-6">
        <h3 className="text-lg font-semibold tracking-tight text-ink">הטיולים שלי</h3>
        {trips && trips.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/trips?filter=all")}
            className="text-sm font-medium text-accent"
          >
            לכל הטיולים
          </button>
        )}
      </div>

      {trips !== null && trips.length === 0 && (
        <div className="px-6">
          <button
            type="button"
            onClick={() => router.push("/ai")}
            className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-card border-[3px] border-dashed border-[var(--color-primary-start)]/70 bg-transparent transition active:scale-[0.98]"
          >
            {/* עיגול ה-"+" המעוצב שנשלח - קובץ עצמאי, לא חלק מהבלוק עצמו,
                כך שאפשר להחליף אותו בעתיד בלי לגעת במסגרת/בטקסט. */}
            <Image src="/icons/add-trip-plus.png" alt="" width={44} height={44} className="h-11 w-11" />
            <span className="text-sm font-semibold text-accent">אין לכם עוד טיול? לחצו כאן</span>
          </button>
        </div>
      )}

      {trips === null && (
        <div className="px-6">
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
      )}

      {trips !== null && trips.length > 0 && (
        // תיקון Product מפורש ("ההחלקה לא טובה בטלפון - נבלע עם הגלילה
        // למטה"): embla-carousel מגדיר touch-action על ה-viewport שלו
        // דרך JS אחרי mount - יש לזה חלון קצר שבו הדפדפן (בעיקר iOS
        // Safari) עדיין לא "יודע" שיש כאן גרירה אופקית, ומחליט "לנעול"
        // scroll אנכי רגיל על מגע ראשוני. touchAction: "pan-y" מפורש כאן
        // ב-CSS (לא רק JS) מבטל את חוסר הוודאות הזה - "מותר scroll אנכי
        // טבעי, אבל לא אופקי" ידוע לדפדפן מהרגע הראשון, בלי תלות בתזמון
        // effect. תואם בדיוק להנחה שכבר קיימת בהערה ב-SwipeUpToDeleteCard.tsx.
        <div className="overflow-x-hidden overflow-y-visible px-6" style={{ touchAction: "pan-y" }} ref={emblaRef}>
          <div className="flex">
            {trips.map((trip) => (
              <div
                key={`${trip.isTrippyAi ? "ai" : "session"}-${trip.id}`}
                className="min-w-0 shrink-0 grow-0"
                style={{ flexBasis: "45%", marginInlineEnd: 12 }}
              >
                <SwipeUpToDeleteCard onDelete={() => handleDeleteTrip(trip)}>
                  <button
                    type="button"
                    onClick={() => router.push(tripResultPath(trip))}
                    className="relative block h-32 w-full overflow-hidden rounded-card bg-bg-secondary text-right shadow-soft"
                  >
                    {trip.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-bg-secondary text-xl">🧳</div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.3)_60%,transparent_100%)] p-2 pt-8">
                      <p className="truncate text-xs font-bold text-white">{trip.destinationLabel}</p>
                      <p className="mt-0.5 text-[10px] text-white/85">{trip.stopCount} תחנות</p>
                    </div>
                  </button>
                </SwipeUpToDeleteCard>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
