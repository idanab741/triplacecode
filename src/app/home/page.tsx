"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import { getFirstName } from "@/utils/greeting";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeHero } from "@/screens/home/HomeHero";
import { HomeHeader } from "@/screens/home/HomeHeader";
import { GreetingBlock } from "@/screens/home/GreetingBlock";
import { SearchBarLink } from "@/screens/home/SearchBarLink";
import { QuickCategories } from "@/screens/home/QuickCategories";
import { DiscoverCard } from "@/screens/home/DiscoverCard";
import { MyTripsSection } from "@/screens/home/MyTripsSection";
import { PartnersSection } from "@/screens/home/PartnersSection";

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || profileLoading || !user) return;

    const isGuest = Boolean(user.is_anonymous);

    if (!isGuest && !isMainOnboardingComplete(profile)) {
      router.replace("/onboarding");
      return;
    }

    if (isGuest) return;

    if (!isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  const isGuest = Boolean(user?.is_anonymous);
  const displayName = isGuest ? null : getFirstName(profile?.full_name);

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-b-[50px]" style={{ backgroundColor: "#e5e6f4" }}>
          <HomeHeader avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />
          <HomeHero />

          <div className="flex flex-col pb-6">
            <GreetingBlock name={displayName} loading={loading || profileLoading} />
            <div className="mt-4">
              <SearchBarLink />
            </div>
            <div className="mt-7">
              <QuickCategories />
            </div>
          </div>
        </div>

        {/* תיקון Product מפורש ("אני רוצה להעביר את מותאם בשבילך - לתוך
            עמוד חופשה בחו''ל"): קרוסלת "מותאם בשבילך"/"יעדים חמים"
            (HotDestinations) הוסרה מכאן - עברה במלואה ל-
            /trip-builder/abroad-vacation/discover (ר' usePersonalizedDestinations.ts). */}
        <div className="flex flex-col gap-6 pb-4 pt-5">
          <DiscoverCard />
          <MyTripsSection />
          <PartnersSection />
        </div>
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
