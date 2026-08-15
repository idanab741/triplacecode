"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getFavoritePlaces, type FavoriteStatus } from "@/services/favorites/favoritesService";
import type { UnifiedPlace } from "@/services/places/unifiedPlaceService";
import { Button, Screen, Skeleton } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { FavoriteCard } from "@/screens/favorites/FavoriteCard";

type Tab = "liked" | "saved";

const TAB_LABELS: Record<Tab, string> = {
  liked: "אהבתי",
  saved: "שמורים",
};

const EMPTY_MESSAGES: Record<Tab, string> = {
  liked: "עוד לא סימנת יעדים שאהבת — צא לגלות!",
  saved: "עוד לא שמרת יעדים — צא לגלות!",
};

function FavoritesTabContent({ userId, status }: { userId: string; status: Tab }) {
  const [places, setPlaces] = useState<UnifiedPlace[] | null>(null);

  useEffect(() => {
    getFavoritePlaces(userId, status as FavoriteStatus).then(setPlaces);
  }, [userId, status]);

  if (places === null) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-secondary">{EMPTY_MESSAGES[status]}</p>
        <Button href="/home">לדף הבית</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {places.map((place) => (
        <FavoriteCard key={place.id} place={place} />
      ))}
    </div>
  );
}

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("liked");

  return (
    <Screen>
      <div className="mx-auto flex max-w-xl flex-col gap-5 pt-2">
        <h1 className="text-xl font-bold text-ink">מועדפים</h1>

        <div className="flex rounded-pill bg-bg-secondary p-1">
          {(["liked", "saved"] as Tab[]).map((t) => (
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

        {loading || !user ? (
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <FavoritesTabContent key={tab} userId={user.id} status={tab} />
        )}
      </div>

      <MainBottomNav active="favorites" />
    </Screen>
  );
}
