"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTravelTime } from "@/hooks/useTravelTime";
import { getUnifiedPlace, type UnifiedPlace } from "@/services/places/unifiedPlaceService";
import {
  getFavoriteStatus,
  toggleFavorite,
  skipPlace,
  type FavoriteStatus,
} from "@/services/favorites/favoritesService";
import { Screen, Skeleton } from "@/components/ui";
import { ImageCarousel } from "@/screens/place/ImageCarousel";
import { PlaceStatsRow } from "@/screens/place/PlaceStatsRow";
import { PlaceActionButtons } from "@/screens/place/PlaceActionButtons";
import { SignupPrompt } from "@/screens/place/SignupPrompt";

export default function PlacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [place, setPlace] = useState<UnifiedPlace | null | undefined>(undefined);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const isGuest = Boolean(user?.is_anonymous);

  useEffect(() => {
    getUnifiedPlace(params.id).then(setPlace);
  }, [params.id]);

  useEffect(() => {
    if (user && place) {
      getFavoriteStatus(user.id, place.id).then(setFavoriteStatus);
    }
  }, [user, place]);

  const { minutes: travelMinutes } = useTravelTime(
    place?.type === "place" ? place.latitude : null,
    place?.type === "place" ? place.longitude : null
  );

  async function handleAction(action: "liked" | "saved") {
    if (!user || !place) return;
    if (isGuest) {
      setShowSignupPrompt(true);
      return;
    }
    const next = await toggleFavorite(user.id, place.id, place.type, action);
    setFavoriteStatus(next);
  }

  async function handleSkip() {
    if (!user || !place) {
      router.back();
      return;
    }
    if (isGuest) {
      setShowSignupPrompt(true);
      return;
    }
    await skipPlace(user.id, place.id, place.type);
    router.back();
  }

  if (authLoading || place === undefined) {
    return (
      <Screen withBottomNavSpacing={false}>
        <Skeleton className="h-96 w-full rounded-none" />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Screen>
    );
  }

  if (place === null) {
    return (
      <Screen withBottomNavSpacing={false}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-bold text-ink">היעד לא נמצא</p>
          <p className="text-sm text-ink-secondary">אולי הוא הוסר, או שהקישור שגוי</p>
          <button type="button" onClick={() => router.push("/home")} className="text-sm text-accent">
            חזרה לדף הבית
          </button>
        </div>
      </Screen>
    );
  }

  const categoryLine = [place.subcategory, place.category].filter(Boolean).join(" - ");

  return (
    <div className="min-h-screen bg-bg pb-32">
      <div className="relative h-[65vh] w-full">
        <ImageCarousel images={place.imageUrls} alt={place.name} />

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="חזרה"
          className="absolute start-4 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>

        <p className="absolute top-6 inset-x-0 text-center text-sm font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
          triplace
        </p>

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent)] px-6 pb-6 pt-16">
          <h1 className="text-2xl font-extrabold text-white">{place.name}</h1>
          {categoryLine && <p className="mt-1 text-sm text-white/80">{categoryLine}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-5">
        <PlaceStatsRow
          rating={place.rating}
          estimatedVisitMinutes={place.estimatedVisitMinutes}
          priceLevel={place.priceLevel}
          travelMinutes={place.type === "place" ? travelMinutes : null}
        />

        {place.shortDescription && (
          <p className="px-6 text-sm leading-relaxed text-ink-secondary">
            {place.shortDescription}
          </p>
        )}
      </div>

      <PlaceActionButtons
        liked={favoriteStatus === "liked"}
        saved={favoriteStatus === "saved"}
        onLike={() => handleAction("liked")}
        onSave={() => handleAction("saved")}
        onSkip={handleSkip}
      />

      {showSignupPrompt && <SignupPrompt onClose={() => setShowSignupPrompt(false)} />}
    </div>
  );
}
