"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";

/**
 * אותה בדיקה בדיוק שהייתה בעמוד הבית הקודם (עבר ל-/tripmatch): משתמש רשום
 * שלא סיים onboarding / פרופיל מופנה להשלמה. אורחים (anonymous) - לא.
 * נשאר על עמוד הבית, כי הוא נקודת הכניסה לאפליקציה.
 */
export function HomeOnboardingGuard() {
  const { user, loading, profile, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || profileLoading || !user) return;
    if (user.is_anonymous) return;
    if (!isMainOnboardingComplete(profile)) {
      router.replace("/onboarding");
      return;
    }
    if (!isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  return null;
}
