"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Skeleton, SwipeUpToDeleteCard } from "@/components/ui";

interface TripPreview {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
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
    fetch(`/api/trip-builder/sessions/saved?all=true&limit=${PREVIEW_LIMIT}`)
      .then((res) => res.json())
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => setTrips([]));
  }, []);

  async function handleDeleteTrip(sessionId: string) {
    setTrips((prev) => (prev ? prev.filter((t) => t.sessionId !== sessionId) : prev));
    await fetch(`/api/trip-builder/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
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
        <div className="overflow-x-hidden overflow-y-visible px-6" ref={emblaRef}>
          <div className="flex">
            {trips.map((trip) => (
              <div
                key={trip.sessionId}
                className="min-w-0 shrink-0 grow-0"
                style={{ flexBasis: "45%", marginInlineEnd: 12 }}
              >
                <SwipeUpToDeleteCard onDelete={() => handleDeleteTrip(trip.sessionId)}>
                  <button
                    type="button"
                    onClick={() => router.push(tripResultPath(trip.tripType, trip.sessionId))}
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
