"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { PostCard } from "@/screens/places/PostCard";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import type { FeedItemDto } from "@/services/social/feedService";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "שגיאה");
  return data as T;
}

/**
 * עמוד פוסט / ביקורת: הפוסט עצמו (כמו בפיד - טקסט, תמונות, מקום, לייק / שמירה / שיתוף) והתגובות פתוחות מתחתיו.
 * אליו מגיעים מהאריחים בפרופיל, מהתראות ומשיתוף בצ'אט. קודם העמוד הזה הציג רק תגובות.
 */
export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<FeedItemDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);

  function load() {
    setStatus("loading");
    fetch(`/api/social/posts/${id}`)
      .then(async (res) => {
        if (res.status === 404) return setStatus("notfound");
        if (!res.ok) return setStatus("error");
        const data = await res.json();
        setPost(data.post as FeedItemDto);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(load, [id]);

  async function handleLikeToggle(postId: string) {
    const { liked } = await fetchJson<{ liked: boolean }>(`/api/social/posts/${postId}/like`, { method: "POST" });
    return liked;
  }
  async function handleSaveToggle(postId: string) {
    const { saved } = await fetchJson<{ saved: boolean }>(`/api/social/posts/${postId}/save`, { method: "POST" });
    return saved;
  }
  async function handleEditPost(postId: string, newText: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ text: newText }) });
  }
  async function handleDeletePost(postId: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "DELETE" });
    router.back();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PlacesHeader onBack={() => router.back()} />

      <div className="flex-1 pb-10">
        {status === "loading" && (
          <div className="p-4">
            <Skeleton className="mb-3 h-12 w-full" />
            <Skeleton className="mb-3 h-64 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {status === "notfound" && <PlacesEmptyState title="הפוסט לא נמצא - ייתכן שנמחק או שאין לך הרשאה לראות אותו." />}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-ink-secondary">לא הצלחנו לטעון את הפוסט.</p>
            <button type="button" onClick={load} className="text-sm font-semibold text-places-purple">
              נסו שוב
            </button>
          </div>
        )}

        {status === "ready" && post && (
          <PostCard
            item={post}
            defaultCommentsOpen
            onLikeToggle={handleLikeToggle}
            onSaveToggle={handleSaveToggle}
            onWriteReview={(placeId, placeName) => setReviewTarget({ placeId, placeName })}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
          />
        )}
      </div>

      {reviewTarget && (
        <CreateReviewSheet
          placeId={reviewTarget.placeId}
          placeName={reviewTarget.placeName}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
