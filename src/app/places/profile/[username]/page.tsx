"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { MainBottomNav } from "@/components/MainBottomNav";
import { PostCard } from "@/screens/places/PostCard";
import { CreateMenuSheet } from "@/screens/places/CreateMenuSheet";
import { CreatePostSheet } from "@/screens/places/CreatePostSheet";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import { ReviewPlacePickerSheet } from "@/screens/places/ReviewPlacePickerSheet";
import { SuggestPlaceSheet } from "@/screens/places/SuggestPlaceSheet";
import { useAuth } from "@/hooks/useAuth";
import type { SocialProfileDto } from "@/services/social/socialProfileService";
import type { FeedItemDto } from "@/services/social/feedService";
import type { PostVisibility } from "@/services/social/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה");
  }
  return res.json();
}

export default function SocialProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SocialProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<FeedItemDto[] | null>(null);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [suggestPlaceOpen, setSuggestPlaceOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);

  useEffect(() => {
    fetchJson<{ profile: SocialProfileDto }>(`/api/social/profile/${username}`)
      .then((r) => setProfile(r.profile))
      .catch((err) => setError(err.message));
  }, [username]);

  useEffect(() => {
    setPosts(null);
    fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(`/api/social/profile/${username}/posts`)
      .then((r) => {
        setPosts(r.items);
        setPostsNextCursor(r.nextCursor);
      })
      .catch(() => setPosts([]));
  }, [username]);

  async function handleLoadMorePosts() {
    if (!postsNextCursor) return;
    setPostsLoadingMore(true);
    try {
      const { items, nextCursor } = await fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(
        `/api/social/profile/${username}/posts?cursor=${encodeURIComponent(postsNextCursor)}`
      );
      setPosts((prev) => [...(prev ?? []), ...items]);
      setPostsNextCursor(nextCursor);
    } finally {
      setPostsLoadingMore(false);
    }
  }

  async function handleLikeToggle(postId: string): Promise<boolean> {
    const { liked } = await fetchJson<{ liked: boolean }>(`/api/social/posts/${postId}/like`, { method: "POST" });
    return liked;
  }

  async function handleSaveToggle(postId: string): Promise<boolean> {
    const { saved } = await fetchJson<{ saved: boolean }>(`/api/social/posts/${postId}/save`, { method: "POST" });
    return saved;
  }

  function handleOpenComments(postId: string) {
    router.push(`/places/post/${postId}`);
  }

  async function handleEditPost(postId: string, newText: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ text: newText }) });
  }

  async function handleDeletePost(postId: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "DELETE" });
    setPosts((prev) => prev?.filter((i) => i.id !== postId) ?? null);
  }

  async function handleCreatePost(text: string, visibility: PostVisibility, mediaIds: string[]) {
    await fetchJson("/api/social/posts", {
      method: "POST",
      body: JSON.stringify({ text, visibility, postType: mediaIds.length ? "photo" : "post", mediaIds }),
    });
    const { items, nextCursor } = await fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(
      `/api/social/profile/${username}/posts`
    );
    setPosts(items);
    setPostsNextCursor(nextCursor);
  }

  async function handleFollowToggle() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.viewerState.following) {
        await fetchJson(`/api/social/follows?userId=${profile.id}`, { method: "DELETE" });
      } else {
        await fetchJson("/api/social/follows", { method: "POST", body: JSON.stringify({ userId: profile.id }) });
      }
      setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, following: !p.viewerState.following } } : p));
    } finally {
      setBusy(false);
    }
  }

  async function handleFriendAction() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.viewerState.friendStatus === "none") {
        await fetchJson("/api/social/friends", { method: "POST", body: JSON.stringify({ userId: profile.id }) });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "pending", isRequester: true } } : p));
      } else if (profile.viewerState.friendStatus === "pending" && profile.viewerState.isRequester) {
        await fetchJson(`/api/social/friends?id=${profile.viewerState.friendshipId}&mode=cancel`, { method: "DELETE" });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "none", friendshipId: null } } : p));
      } else if (profile.viewerState.friendStatus === "accepted") {
        await fetchJson(`/api/social/friends?id=${profile.viewerState.friendshipId}&mode=remove`, { method: "DELETE" });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "none", friendshipId: null } } : p));
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) return <PlacesEmptyState title={error} />;

  if (!profile) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-32 w-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  const friendLabel =
    profile.viewerState.friendStatus === "accepted"
      ? "חברים"
      : profile.viewerState.friendStatus === "pending"
        ? profile.viewerState.isRequester
          ? "בקשה נשלחה"
          : "אשר בקשה"
        : "הוסף חבר";

  return (
    <div className="min-h-screen bg-white pb-24">
      <PlacesHeader onBack={() => router.back()} />

      <div className="h-28 w-full bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {profile.coverUrl && <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between">
          <span className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-bg-secondary">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-ink-secondary">
                {profile.fullName?.[0] ?? "?"}
              </span>
            )}
          </span>

          {!profile.viewerState.isSelf && (
            <div className="flex gap-2 pb-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleFriendAction}
                className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold disabled:opacity-50"
                style={{ border: "1px solid var(--color-places-purple)", color: "var(--color-places-purple)" }}
              >
                {friendLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleFollowToggle}
                className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                style={{ background: "var(--color-places-purple)" }}
              >
                {profile.viewerState.following ? "עוקב" : "עקוב"}
              </button>
            </div>
          )}
          {profile.viewerState.isSelf && (
            <div className="pb-1">
              <button
                type="button"
                onClick={() => router.push("/places/settings")}
                className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold"
                style={{ border: "1px solid var(--color-places-purple)", color: "var(--color-places-purple)" }}
              >
                עריכת פרופיל
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-[17px] font-bold text-ink">
            {profile.fullName}
            {profile.isCreator && (
              <span className="ms-1" style={{ color: "var(--color-places-purple)" }}>
                ✓
              </span>
            )}
          </h2>
          {profile.username && (
            <span dir="ltr" className="text-[13px] text-ink-secondary">
              @{profile.username}
            </span>
          )}
        </div>
        {profile.bio && <p className="mt-2 text-[13.5px] text-ink">{profile.bio}</p>}

        <div className="mt-4 flex gap-5 border-y border-ink-secondary/10 py-3 text-center">
          <Link href={`/places/profile/${username}/followers`} className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.followers}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקבים</div>
          </Link>
          <Link href={`/places/profile/${username}/following`} className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.following}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקב</div>
          </Link>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.friends}</div>
            <div className="text-[11.5px] text-ink-secondary">חברים</div>
          </div>
        </div>

        {profile.viewerState.isSelf && (
          <button
            type="button"
            onClick={() => setCreateMenuOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-pill py-2.5 text-[13.5px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none">+</span>
            צור תוכן חדש
          </button>
        )}

      </div>

      <div className="mt-4 border-t border-ink-secondary/10 px-3 pt-3">
        <h3 className="mb-2 px-1 text-[13px] font-bold text-ink">פוסטים</h3>
        {posts === null && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-card" />
            ))}
          </div>
        )}
        {posts !== null && posts.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-secondary">אין עדיין פוסטים להצגה כאן.</p>
        )}
        {posts !== null && posts.length > 0 && (
          <div>
            {posts.map((item) => (
              <PostCard
                key={item.id}
                item={item}
                onLikeToggle={handleLikeToggle}
                onSaveToggle={handleSaveToggle}
                onOpenComments={handleOpenComments}
                onWriteReview={(placeId) => router.push(`/place/${placeId}`)}
                onEditPost={handleEditPost}
                onDeletePost={handleDeletePost}
              />
            ))}
            {postsNextCursor && (
              <button
                type="button"
                onClick={handleLoadMorePosts}
                disabled={postsLoadingMore}
                className="w-full py-4 text-[13px] font-semibold text-ink-secondary disabled:opacity-50"
              >
                {postsLoadingMore ? "טוען..." : "טען עוד"}
              </button>
            )}
          </div>
        )}
      </div>

      <MainBottomNav active="profile" />

      {createMenuOpen && (
        <CreateMenuSheet
          onClose={() => setCreateMenuOpen(false)}
          onSelectPost={() => setCreatePostOpen(true)}
          onSelectReview={() => setReviewPickerOpen(true)}
          onSelectPlace={() => setSuggestPlaceOpen(true)}
          onSelectTrip={() => router.push("/tripmatch")}
        />
      )}

      {createPostOpen && (
        <CreatePostSheet
          onClose={() => setCreatePostOpen(false)}
          onSubmit={handleCreatePost}
          onBack={() => {
            setCreatePostOpen(false);
            setCreateMenuOpen(true);
          }}
        />
      )}

      {reviewPickerOpen && (
        <ReviewPlacePickerSheet
          onClose={() => setReviewPickerOpen(false)}
          onSelectPlace={(place) => {
            setReviewPickerOpen(false);
            setReviewTarget({ placeId: place.id, placeName: place.name });
          }}
          onSuggestNewPlace={() => setSuggestPlaceOpen(true)}
          onBack={() => {
            setReviewPickerOpen(false);
            setCreateMenuOpen(true);
          }}
        />
      )}

      {suggestPlaceOpen && (
        <SuggestPlaceSheet
          onClose={() => setSuggestPlaceOpen(false)}
          onBack={() => {
            setSuggestPlaceOpen(false);
            setCreateMenuOpen(true);
          }}
        />
      )}

      {reviewTarget && (
        <CreateReviewSheet
          placeId={reviewTarget.placeId}
          placeName={reviewTarget.placeName}
          onClose={() => setReviewTarget(null)}
          onBack={() => {
            setReviewTarget(null);
            setReviewPickerOpen(true);
          }}
          onSubmitted={() => {
            setReviewTarget(null);
            fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(`/api/social/profile/${username}/posts`).then(
              (r) => setPosts(r.items)
            );
          }}
        />
      )}
    </div>
  );
}
