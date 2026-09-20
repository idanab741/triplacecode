"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
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
        <TripForm mode="create" />
      )}
    </div>
  );
}
