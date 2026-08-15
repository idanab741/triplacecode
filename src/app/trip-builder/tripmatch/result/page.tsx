"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen, Skeleton } from "@/components/ui";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import dynamic from "next/dynamic";
import { getCategoryLabel } from "@/utils/categoryLabels";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

interface SavedStop {
  stopId: string;
  placeId: string;
  name: string;
  category: string;
  imageUrls: string[];
  rating: number | null;
  latitude: number;
  longitude: number;
}

export default function TripMatchSavedResultPage() {
  return (
    <Suspense>
      <TripMatchSavedResultContent />
    </Suspense>
  );
}

function TripMatchSavedResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [destinationLabel, setDestinationLabel] = useState<string>("");
  const [stops, setStops] = useState<SavedStop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("חסר מזהה טיול");
      return;
    }
    fetch(`/api/trip-builder/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const answers = data.session?.answers as { destination?: string } | null;
        const itinerary = data.session?.final_itinerary as { stops?: SavedStop[] } | null;
        setDestinationLabel(answers?.destination ?? "הטיול שלי");
        setStops(itinerary?.stops ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את הטיול"));
  }, [sessionId]);

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <SimpleAppHeader onBack={() => router.push("/trips")} title={destinationLabel || "TripMatch"} />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        {error ? (
          <p className="pt-16 text-center text-sm text-danger">{error}</p>
        ) : stops === null ? (
          <>
            <Skeleton className="h-64 w-full rounded-card" />
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-card" />
              ))}
            </div>
          </>
        ) : (
          <>
            <ResultMap
              stops={stops.map((s) => ({ stopId: s.stopId, name: s.name, latitude: s.latitude, longitude: s.longitude }))}
            />
            <div className="flex flex-col gap-3">
              {stops.map((stop) => (
                <div key={stop.stopId} className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right">
                  {stop.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stop.imageUrls[0]} alt={stop.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{stop.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-secondary">
                      {getCategoryLabel(stop.category)}
                      {stop.rating != null && ` · ⭐ ${stop.rating.toFixed(1)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <MainBottomNav active="favorites" />
    </Screen>
  );
}
