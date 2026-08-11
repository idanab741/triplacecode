"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoritePlaces, toggleFavorite } from "@/services/favorites/favoritesService";
import type { UnifiedPlace } from "@/services/places/unifiedPlaceService";
import { Screen, Skeleton, Button, SwipeToDeleteRow } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";

interface SavedTrip {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
}

type Tab = "all" | "saved" | "liked";

const TAB_LABELS: Record<Tab, string> = {
  all: "כל הטיולים",
  saved: "שמורים",
  liked: "לייקים",
};

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

export default function TripsPage() {
  return (
    <Suspense>
      <TripsPageContent />
    </Suspense>
  );
}

function TripsPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const [trips, setTrips] = useState<SavedTrip[] | null>(null);
  const [places, setPlaces] = useState<UnifiedPlace[] | null>(null);

  useEffect(() => {
    if (!user || tab === "liked") return;
    setTrips(null);
    const params = new URLSearchParams();
    if (tab === "all") params.set("all", "true");
    fetch(`/api/trip-builder/sessions/saved?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => setTrips([]));
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== "liked") return;
    setPlaces(null);
    getFavoritePlaces(user.id, "liked")
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [user, tab]);

  async function handleDeleteTrip(sessionId: string) {
    setTrips((prev) => (prev ? prev.filter((t) => t.sessionId !== sessionId) : prev));
    await fetch(`/api/trip-builder/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleUnlikePlace(placeId: string) {
    setPlaces((prev) => (prev ? prev.filter((p) => p.id !== placeId) : prev));
    if (!user) return;
    const supabase = createClient();
    await toggleFavorite(supabase, user.id, placeId, "place", "liked").catch(() => {});
  }

  const tripEmptyMessage =
    tab === "all"
      ? "עוד לא בנית אף מסלול - כשתבנו טיול, הוא יופיע כאן."
      : 'עוד לא שמרת אף טיול - כשתבנו מסלול ותשמרו אותו (בעזרת כפתור ה"שמור"), הוא יופיע כאן.';

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
        <div className="relative h-16">
          <div className="absolute left-2 top-4 flex items-center gap-2">
            <Image src="/images/trip-triplace-logo.png" alt="" width={130} height={40} className="object-contain" />
            <button
              type="button"
              onClick={() => router.push("/home")}
              aria-label="חזרה"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>

          <div className="absolute right-5 top-4 flex h-9 items-center">
            <h1 className="text-base font-bold text-ink">הטיולים שלי</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        <div className="flex rounded-pill bg-bg-secondary p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-pill py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
                  : "text-ink-secondary"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab !== "liked" ? (
          loading || trips === null ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-card" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-ink-secondary">{tripEmptyMessage}</p>
              <Button href="/home">לדף הבית</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trips.map((trip) => (
                <SwipeToDeleteRow key={trip.sessionId} resetKey={tab} onDelete={() => handleDeleteTrip(trip.sessionId)}>
                  <button
                    type="button"
                    onClick={() => router.push(tripResultPath(trip.tripType, trip.sessionId))}
                    className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-white p-3 text-right shadow-soft"
                  >
                    {trip.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">🧳</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink">{trip.destinationLabel}</p>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        {trip.stopCount} תחנות · נשמר ב-{formatDate(trip.createdAt)}
                      </p>
                    </div>
                  </button>
                </SwipeToDeleteRow>
              ))}
            </div>
          )
        ) : loading || places === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-ink-secondary">עוד לא סימנת לייק לאף אטרקציה ב-TripMatch - צאו לגלות!</p>
            <Button href="/tripmatch">ל-TripMatch</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {places.map((place) => (
              <SwipeToDeleteRow key={place.id} resetKey={tab} onDelete={() => handleUnlikePlace(place.id)}>
                <button
                  type="button"
                  onClick={() => router.push(place.type === "destination" ? `/destination/${place.id}` : `/place/${place.id}`)}
                  className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-white p-3 text-right shadow-soft"
                >
                  {place.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={place.imageUrls[0]} alt={place.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{place.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-secondary">
                      {[place.subcategory, place.category, place.city].filter(Boolean)[0]}
                      {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                    </p>
                  </div>
                </button>
              </SwipeToDeleteRow>
            ))}
          </div>
        )}
      </div>

      <MainBottomNav active="profile" />
    </Screen>
  );
}
