"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TripForm } from "@/screens/trips/TripForm";

/** "צרו את הטיול שלכם" - + -> טיול. שם, קאבר, תחנות, סדר, ימים (אם צריך), פרסום. */
export default function CreateTripPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  return (
    <div className="min-h-screen bg-white" style={CREATE_INK}>
      {/* *** עיצוב מחדש: הבר העליון של triplace (עם חזור) במקום הבר הסגול של place's. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      {authLoading || !user ? (
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="mb-6 h-4 w-44" />
          <Skeleton className="mb-6 h-12 w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
      ) : (
        // *** תיקון (בקשה מפורשת - "גם פה אין בר תחתון - צריך להוסיף, וגם ב'חפשו מקום להוסיף
        // לטיול' - צריך להעלים את הרקע החסר מתחת לחלון הקופץ"): pb-24 כדי ש"פרסום טיול" לא
        // ייחסם ע"י הבר. הוספת MainBottomNav גם פותרת את "הרקע החסר" מתחת לפופאפ - BottomSheet
        // כבר משאיר בכוונה פס פנוי בגובה 88px מתחת לכרטיס בדיוק בשביל שהבר התחתון (z-50, מעל
        // ה-backdrop של ה-Sheet, z-40) יופיע דרכו - בלי בר בעמוד בכלל, הפס הזה היה ריק/אפור.
        <div className="pb-24">
          <TripForm mode="create" />
        </div>
      )}
      <MainBottomNav active="content" />
    </div>
  );
}
