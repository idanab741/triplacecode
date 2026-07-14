"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isProfileComplete } from "@/services/profile/profileService";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";
import { getFeaturedDestinations } from "@/services/destinations/destinationsService";
import { getFirstName } from "@/utils/greeting";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeHero } from "@/screens/home/HomeHero";
import { GreetingBlock } from "@/screens/home/GreetingBlock";
import { SearchBarLink } from "@/screens/home/SearchBarLink";
import { QuickCategories } from "@/screens/home/QuickCategories";
import { DiscoverCard } from "@/screens/home/DiscoverCard";
import { HotDestinations, type Destination } from "@/screens/home/HotDestinations";

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
    preferences,
    preferencesLoading,
  } = useAuth();
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    if (loading || profileLoading || preferencesLoading || !user) return;

    if (!isProfileComplete(profile)) {
      router.replace("/profile-setup");
    } else if (!isPreferencesComplete(preferences)) {
      router.replace("/preferences");
    }
  }, [loading, profileLoading, preferencesLoading, user, profile, preferences, router]);

  useEffect(() => {
    getFeaturedDestinations().then((rows) => {
      setDestinations(
        rows
          .filter((row) => row.image_url)
          .map((row) => ({
            id: row.id,
            name: row.name,
            subtitle: row.country,
            imageUrl: row.image_url as string,
          }))
      );
    });
  }, []);

  const isGuest = Boolean(user?.is_anonymous);
  const displayName = isGuest ? null : getFirstName(profile?.full_name);

  useEffect(() => {
    if (isGuest || !user || !isPreferencesComplete(preferences)) return;
    if (destinations.length === 0 || personalized) return;

    let cancelled = false;

    fetch("/api/match/rank-destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationIds: destinations.map((d) => d.id) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.results) return;
        const scoreById = new Map(
          (data.results as { destination_id: string; score: number; reason: string }[]).map(
            (r) => [r.destination_id, r]
          )
        );
        setDestinations((prev) =>
          [...prev]
            .map((d) => {
              const match = scoreById.get(d.id);
              return match
                ? { ...d, matchScore: match.score, matchReason: match.reason }
                : d;
            })
            .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
        );
        setPersonalized(true);
      })
      .catch(() => {
        // אם הדירוג נכשל, פשוט נשארים עם הסדר הכללי - המסך לא נשבר
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, user, preferences, destinations, personalized]);

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="mx-auto max-w-xl">
        <HomeHero avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />

        <div className="flex flex-col gap-6 pb-4 pt-5">
          <GreetingBlock name={displayName} loading={loading || profileLoading} />
          <SearchBarLink />
          <QuickCategories />
          <DiscoverCard />
          <HotDestinations
            title={personalized ? "מותאם בשבילך" : "יעדים חמים"}
            destinations={destinations}
          />
        </div>
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
