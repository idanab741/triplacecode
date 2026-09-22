"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { CollectionForm, type CollectionFormInitial } from "@/screens/collections/CollectionForm";
import { formItemFromDto } from "@/screens/collections/collectionFormTypes";
import type { CollectionDetailDto } from "@/services/social/collectionTypes";

/** עריכת אוסף - ליוצר בלבד: כותרת, תיאור, Cover, הוספה/הסרה/סדר פריטים, פרטיות, ומחיקה. */
export default function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/social/collections/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת האוסף");
        return data.collection as CollectionDetailDto;
      })
      .then((c) => (c.viewerState.isSelf ? setCollection(c) : setError("רק היוצר יכול לערוך את האוסף")))
      .catch((err) => setError(err.message));
  }, [id, user]);

  const initial: CollectionFormInitial | null = collection && {
    title: collection.title,
    description: collection.description ?? "",
    coverUrl: collection.coverUrl,
    visibility: collection.visibility,
    items: collection.items.map(formItemFromDto),
  };

  return (
    <div className="min-h-screen bg-white">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />
      {error ? (
        <PlacesEmptyState title={error} />
      ) : !collection || !initial ? (
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <CollectionForm mode="edit" type={collection.type} collectionId={collection.id} initial={initial} />
      )}
    </div>
  );
}
