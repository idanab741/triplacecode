"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { MainBottomNav } from "@/components/MainBottomNav";
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
    <div className="min-h-screen bg-white" style={CREATE_INK}>
      {/* *** עיצוב מחדש: הבר העליון של triplace (עם חזור), כמו בעמוד יצירת הטיול. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      {error ? (
        <PlacesEmptyState title={error} />
      ) : !trip ? (
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="mb-6 h-4 w-44" />
          <Skeleton className="mb-6 h-12 w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
      ) : (
        // ר' ההערה המלאה ב-places/trip/create/page.tsx - אותו תיקון בדיוק (בר תחתון + פס-88px
        // מתחת לפופאפ "חפשו מקום להוסיף לטיול" שעכשיו יש לו למה "להיתלות").
        <div className="pb-24">
          <TripForm mode="edit" tripId={trip.id} initial={toInitial(trip)} />
        </div>
      )}
      <MainBottomNav active="places" />
    </div>
  );
}
