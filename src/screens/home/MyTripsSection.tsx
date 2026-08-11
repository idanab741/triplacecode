"use client";

import { useRouter } from "next/navigation";
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
            onClick={() => router.push("/trip-builder/build")}
            className="relative h-44 w-full overflow-hidden rounded-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cta-no-trips.png"
              alt="אין לכם עוד טיול? לחצו כאן"
              className="absolute inset-0 h-full w-full object-contain"
            />
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
                    className="flex h-32 w-full flex-col overflow-hidden rounded-card bg-white text-right shadow-soft"
                  >
                    {trip.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-20 w-full object-cover" />
                    ) : (
                      <div className="flex h-20 w-full items-center justify-center bg-bg-secondary text-xl">🧳</div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-bold text-ink">{trip.destinationLabel}</p>
                      <p className="mt-0.5 text-[10px] text-ink-secondary">{trip.stopCount} תחנות</p>
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
