"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
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
    <div className="min-h-screen bg-white">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />
      {authLoading || !user ? (
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
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
