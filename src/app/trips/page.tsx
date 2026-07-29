"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Screen, Skeleton, Button } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";

interface SavedTrip {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export default function SavedTripsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/trip-builder/sessions/saved")
      .then((res) => res.json())
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => setTrips([]));
  }, [user]);

  return (
    <Screen>
      <div className="mx-auto flex max-w-sm flex-col gap-4 px-5 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="חזרה"
            className="flex h-8 w-8 items-center justify-center text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-ink">הטיולים השמורים שלי</h1>
        </div>

        {loading || trips === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-ink-secondary">עוד לא שמרת אף טיול - כשתבנו מסלול ותשמרו אותו, הוא יופיע כאן.</p>
            <Button href="/home">לדף הבית</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <button
                key={trip.sessionId}
                type="button"
                onClick={() => router.push(tripResultPath(trip.tripType, trip.sessionId))}
                className="flex items-center gap-3 overflow-hidden rounded-card bg-white p-3 text-right shadow-soft transition active:scale-[0.98]"
              >
                {trip.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">
                    🧳
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{trip.destinationLabel}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {trip.stopCount} תחנות · נשמר ב-{formatDate(trip.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MainBottomNav active="profile" />
    </Screen>
  );
}
