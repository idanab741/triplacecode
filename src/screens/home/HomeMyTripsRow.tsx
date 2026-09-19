"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeSectionHeader } from "@/screens/home/HomeSectionHeader";

/**
 * *** חדש (בקשה מפורשת - "הטיולים שלי" עם האייקון של המזוודה, מתחת לכפתורי
 * ההחלקות): שורת כרטיסיות אופקית. הכרטיסייה הראשונה תמיד "צור טיול" (מוביל
 * ל-Trippy AI, כמו כפתור היצירה הקיים ב-MyTripsSection), ואחריה הטיולים
 * האחרונים של המשתמש - אותם שני מקורות בדיוק כמו MyTripsSection (טיולי
 * האשף + תוצאות ה-Trippy AI), בלי שינוי בצד השרת.
 * כרטיסיית "צור טיול" לא תלויה בטעינה - מוצגת מיד.
 */
interface TripPreview {
  id: string;
  tripType: string | null;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  isTrippyAi: boolean;
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

const PREVIEW_LIMIT = 10;
const CARD_CLASS = "relative block h-[176px] w-[132px] shrink-0 overflow-hidden rounded-card";

export function HomeMyTripsRow() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripPreview[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trip-builder/sessions/saved?all=true&limit=${PREVIEW_LIMIT}`)
        .then((res) => res.json())
        .catch(() => ({ trips: [] })),
      fetch(`/api/trippy-ai?all=true&limit=${PREVIEW_LIMIT}`)
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
        (r: { id: string; title: string; imageUrl: string | null; stopCount: number; createdAt: string }) => ({
          id: r.id,
          tripType: null,
          destinationLabel: r.title,
          imageUrl: r.imageUrl,
          stopCount: r.stopCount,
          createdAt: r.createdAt,
          isTrippyAi: true,
        })
      );
      const merged = [...fromSessions, ...fromTrippyAi].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTrips(merged.slice(0, PREVIEW_LIMIT));
    });
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <HomeSectionHeader
        iconSrc="/images/home/section-my-trips.webp"
        title="הטיולים שלי"
        actionLabel={trips.length > 0 ? "לכל הטיולים" : undefined}
        onAction={() => router.push("/trips?filter=all")}
      />

      <div className="stories-rail-track flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => router.push("/ai")}
          className={`${CARD_CLASS} flex flex-col items-center justify-center gap-2 border-[3px] border-dashed border-[var(--color-primary-start)]/70 bg-transparent transition active:scale-[0.97]`}
        >
          <Image src="/icons/add-trip-plus.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="text-sm font-semibold text-accent">צור טיול</span>
        </button>

        {trips.map((trip) => (
          <button
            key={`${trip.isTrippyAi ? "ai" : "session"}-${trip.id}`}
            type="button"
            onClick={() => router.push(tripResultPath(trip))}
            className={`${CARD_CLASS} bg-bg-secondary text-right shadow-soft transition active:scale-[0.97]`}
          >
            {trip.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">🧳</div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
              <p className="truncate text-sm font-bold leading-tight text-white">{trip.destinationLabel}</p>
              <p className="text-[11px] text-white/85">{trip.stopCount} תחנות</p>
            </div>
          </button>
        ))}

        <div aria-hidden="true" className="w-1 shrink-0" />
      </div>
    </section>
  );
}
