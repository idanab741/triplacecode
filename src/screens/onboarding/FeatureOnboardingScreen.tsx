"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { FeatureKey } from "@/hooks/useFeatureOnboardingGuard";

/** מסך "הסבר פיצ'ר" בודד - לא חלק מהסיור הראשי, אלא מוצג פעם אחת בלבד
 *  ברגע שהמשתמש מנסה להיכנס לפיצ'ר ספציפי בפעם הראשונה. אחרי "המשך",
 *  מסמן ב-DB שהוא הושלם וממשיך ליעד האמיתי. */
export function FeatureOnboardingScreen({
  feature,
  destination,
  Slide,
}: {
  feature: FeatureKey;
  destination: string;
  Slide: ComponentType;
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`שגיאה בסימון ${feature} כהושלם:\n\n${data?.error ?? res.status}`);
      }
      await refreshProfile();
    } catch (e) {
      alert(`שגיאת רשת: ${e instanceof Error ? e.message : String(e)}`);
    }
    router.replace(destination);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <div className="relative flex flex-1 flex-col">
        <Slide />
      </div>
      <div className="px-6 pb-8 pt-4">
        <Button fullWidth onClick={handleContinue} disabled={loading}>
          {loading ? "רגע..." : "המשך"}
        </Button>
      </div>
    </div>
  );
}
