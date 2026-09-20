"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { TripForm, newTripFormStop, type TripFormInitial } from "@/screens/trips/TripForm";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import type { TripDetailDto } from "@/services/social/tripTypes";

function toInitial(trip: TripDetailDto): TripFormInitial {
  const byDay = new Map<number, TripDetailDto["stops"]>();
  for (const stop of trip.stops) byDay.set(stop.day, [...(byDay.get(stop.day) ?? []), stop]);
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, stops], index) => ({
      id: `day-${day}-${index}`,
      stops: stops
        .sort((a, b) => a.position - b.position)
        .map((s) =>
          newTripFormStop({
            placeId: s.place.id,
            title: s.place.name,
            subtitle: [getPlaceCategoryLabel(s.place.category), s.place.city].filter(Boolean).join(" · ") || null,
            imageUrl: s.place.imageUrls[0] ?? null,
            note: s.note ?? "",
          })
        ),
    }));
  return {
    title: trip.title,
    description: trip.description ?? "",
    coverUrl: trip.coverUrl,
    tripType: trip.tripType,
    visibility: trip.visibility,
    days,
  };
}

/** עריכת טיול - ליוצר בלבד: פרטים, Cover, סוג, ימים, תחנות, סדר, הערות, פרטיות, ומחיקה. */
export default function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/social/trips/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת הטיול");
        return data.trip as TripDetailDto;
      })
      .then((t) => (t.viewerState.isSelf ? setTrip(t) : setError("רק היוצר יכול לערוך את הטיול")))
      .catch((err) => setError(err.message));
  }, [id, user]);

  return (
    <div className="min-h-screen bg-white">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />
      {error ? (
        <PlacesEmptyState title={error} />
      ) : !trip ? (
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <TripForm mode="edit" tripId={trip.id} initial={toInitial(trip)} />
      )}
    </div>
  );
}
