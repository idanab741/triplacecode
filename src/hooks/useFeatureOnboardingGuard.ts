"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export type FeatureKey = "tripmatch" | "tripbuilding";

const FIELD_BY_FEATURE: Record<FeatureKey, string> = {
  tripmatch: "tripmatch_onboarding_completed_at",
  tripbuilding: "tripbuilding_onboarding_completed_at",
};

/** שומר על עמוד פיצ'ר (TripMatch / צ'אט / בונה מסלול): בפעם הראשונה
 *  שמשתמש מגיע לעמוד הזה, מפנה אותו קודם למסך ההסבר של הפיצ'ר
 *  (introPath). רק אחרי שהוא משלים/מדלג שם, הוא חוזר לכאן וה-hook
 *  מחזיר ready=true כדי שהעמוד יציג את התוכן האמיתי שלו.
 *
 *  ready=false גם בזמן הטעינה הראשונית - כדי שהעמוד לא "יבהב" את
 *  התוכן האמיתי לרגע לפני שההפניה למסך ההסבר מתבצעת. */
export function useFeatureOnboardingGuard(feature: FeatureKey, introPath: string): { ready: boolean } {
  const router = useRouter();
  const { user, loading, profile, profileLoading } = useAuth();

  const field = FIELD_BY_FEATURE[feature];
  const completed = Boolean(profile ? (profile as unknown as Record<string, unknown>)[field] : false);

  useEffect(() => {
    if (loading || profileLoading || !user) return;
    if (!completed) {
      router.replace(introPath);
    }
  }, [loading, profileLoading, user, completed, router, introPath]);

  return { ready: !loading && !profileLoading && Boolean(user) && completed };
}
