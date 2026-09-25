"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CREATE_INK } from "@/screens/create/CreateUi";
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
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת המפה");
        return data.collection as CollectionDetailDto;
      })
      .then((c) => (c.viewerState.isSelf ? setCollection(c) : setError("רק היוצר יכול לערוך את המפה")))
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
    <div className="min-h-screen bg-white" style={CREATE_INK}>
      {/* *** עיצוב מחדש: הבר העליון של triplace (עם חזור), כמו בעמוד יצירת החוויה. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      {error ? (
        <PlacesEmptyState title={error} />
      ) : !collection || !initial ? (
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-44" />
          <Skeleton className="mb-6 h-4 w-64" />
          <Skeleton className="mb-6 h-12 w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
      ) : (
        <CollectionForm mode="edit" type={collection.type} collectionId={collection.id} initial={initial} />
      )}
    </div>
  );
}
