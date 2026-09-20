"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { CollectionForm } from "@/screens/collections/CollectionForm";
import type { CollectionType } from "@/services/social/collectionTypes";

/** "יצירת אוסף" - אחרי שבחרו "מה תרצו לאסוף?" (?type=places|trips). הסוג נקבע כאן ולא ניתן לערבב. */
function CreateCollectionContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const typeParam = useSearchParams().get("type");
  const type: CollectionType | null = typeParam === "places" || typeParam === "trips" ? typeParam : null;

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!type) router.replace("/places");
  }, [type, router]);

  if (authLoading || !user || !type) {
    return (
      <div className="min-h-screen bg-white">
        <PlacesHeader variant="purple" onBack={() => router.back()} />
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />
      <CollectionForm mode="create" type={type} />
    </div>
  );
}

export default function CreateCollectionPage() {
  return (
    <Suspense>
      <CreateCollectionContent />
    </Suspense>
  );
}
