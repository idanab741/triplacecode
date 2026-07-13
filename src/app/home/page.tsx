"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isProfileComplete } from "@/services/profile/profileService";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";
import { getHotPlaces } from "@/services/places/placesService";
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

  useEffect(() => {
    if (loading || profileLoading || preferencesLoading || !user) return;

    if (!isProfileComplete(profile)) {
      router.replace("/profile-setup");
    } else if (!isPreferencesComplete(preferences)) {
      router.replace("/preferences");
    }
  }, [loading, profileLoading, preferencesLoading, user, profile, preferences, router]);

  useEffect(() => {
    getHotPlaces().then((places) => {
      setDestinations(
        places
          .filter((place) => place.image_urls.length > 0)
          .map((place) => ({
            id: place.id,
            name: place.name,
            city: place.city,
            imageUrl: place.image_urls[0],
          }))
      );
    });
  }, []);

  const isGuest = Boolean(user?.is_anonymous);
  const displayName = isGuest ? null : getFirstName(profile?.full_name);

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="mx-auto max-w-xl">
        <HomeHero avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />

        <div className="flex flex-col gap-6 pb-4 pt-5">
          <GreetingBlock name={displayName} loading={loading || profileLoading} />
          <SearchBarLink />
          <QuickCategories />
          <DiscoverCard />
          <HotDestinations destinations={destinations} />
        </div>
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
