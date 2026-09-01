"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { StoriesRail } from "@/screens/places/StoriesRail";
import { StoryViewerModal } from "@/screens/places/StoryViewerModal";
import { CreatorsSection } from "@/screens/places/CreatorsSection";
import { SuggestedPeopleCircles } from "@/screens/places/SuggestedPeopleCircles";
import { OnlineFriendsSection } from "@/screens/places/OnlineFriendsSection";
import { MyDestinationsSection } from "@/screens/places/MyDestinationsSection";
import { FeedTabs } from "@/screens/places/FeedTabs";
import { PostCard } from "@/screens/places/PostCard";
import { CreatePostSheet } from "@/screens/places/CreatePostSheet";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import { CreatePostBar } from "@/screens/places/CreatePostBar";
import { CreateMenuSheet } from "@/screens/places/CreateMenuSheet";
import { ReviewPlacePickerSheet } from "@/screens/places/ReviewPlacePickerSheet";
import { SuggestPlaceSheet } from "@/screens/places/SuggestPlaceSheet";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import type { FeedItemDto, FeedTab } from "@/services/social/feedService";
import type { StoryRailAuthorDto } from "@/services/social/storyService";
import type { CreatorCardDto } from "@/services/social/creatorDiscoveryService";
import type { OnlineFriendDto } from "@/services/social/onlinePresenceService";
import type { SuggestedTravelerDto } from "@/services/social/suggestedTravelersService";
import type { PostVisibility } from "@/services/social/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה בטעינת הנתונים");
  }
  return res.json();
}

export default function PlacesHomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [storyRail, setStoryRail] = useState<StoryRailAuthorDto[] | null>(null);
  const [creators, setCreators] = useState<CreatorCardDto[] | null>(null);
  const [suggestedTravelers, setSuggestedTravelers] = useState<SuggestedTravelerDto[] | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriendDto[] | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItemDto[] | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>("for_you");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [suggestPlaceOpen, setSuggestPlaceOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  const loadFeed = useCallback(async (tab: FeedTab) => {
    setFeedItems(null);
    setFeedError(null);
    try {
      const { items, nextCursor } = await fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(
        `/api/social/feed?tab=${tab}`
      );
      setFeedItems(items);
      setNextCursor(nextCursor);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "שגיאה בטעינת ה-Feed");
      setFeedItems([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchJson<{ rail: StoryRailAuthorDto[] }>("/api/social/stories").then((r) => setStoryRail(r.rail)).catch(() => setStoryRail([]));
    fetchJson<{ creators: CreatorCardDto[] }>("/api/social/creators").then((r) => setCreators(r.creators)).catch(() => setCreators([]));
    fetchJson<{ travelers: SuggestedTravelerDto[] }>("/api/social/suggested-travelers")
      .then((r) => setSuggestedTravelers(r.travelers))
      .catch(() => setSuggestedTravelers([]));
    fetchJson<{ friends: OnlineFriendDto[] }>("/api/social/presence/online-friends")
      .then((r) => setOnlineFriends(r.friends))
      .catch(() => setOnlineFriends([]));
    fetch("/api/social/presence/heartbeat", { method: "POST" }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user) loadFeed(feedTab);
  }, [user, feedTab, loadFeed]);

  async function loadMoreFeed() {
    if (!nextCursor || feedLoadingMore) return;
    setFeedLoadingMore(true);
    try {
      const { items, nextCursor: newCursor } = await fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(
        `/api/social/feed?tab=${feedTab}&cursor=${encodeURIComponent(nextCursor)}`
      );
      setFeedItems((prev) => [...(prev ?? []), ...items]);
      setNextCursor(newCursor);
    } finally {
      setFeedLoadingMore(false);
    }
  }

  async function handleFollowToggle(creatorId: string) {
    const isFollowing = creators?.find((c) => c.id === creatorId)?.viewerFollowing;
    if (isFollowing) {
      await fetchJson(`/api/social/follows?userId=${creatorId}`, { method: "DELETE" });
    } else {
      await fetchJson("/api/social/follows", { method: "POST", body: JSON.stringify({ userId: creatorId }) });
    }
    setCreators((prev) => prev?.map((c) => (c.id === creatorId ? { ...c, viewerFollowing: !isFollowing } : c)) ?? null);
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

  async function handleCreatePost(text: string, visibility: PostVisibility, mediaIds: string[]) {
    await fetchJson("/api/social/posts", {
      method: "POST",
      body: JSON.stringify({ text, visibility, postType: mediaIds.length ? "photo" : "post", mediaIds }),
    });
    await loadFeed(feedTab);
  }

  async function handleEditPost(postId: string, newText: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ text: newText }) });
  }

  async function handleDeletePost(postId: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "DELETE" });
    setFeedItems((prev) => prev?.filter((i) => i.id !== postId) ?? null);
  }

  function handleOpenStory(authorIndex: number) {
    setStoryViewerIndex(authorIndex);
  }

  async function handleStoryViewed(storyId: string) {
    fetchJson(`/api/social/stories/${storyId}/view`, { method: "POST" }).catch(() => {});
    // עדכון מקומי מיידי - כדי שהטבעת הסגולה תיעלם ברגע שנצפו כל
    // הסטוריז של אותו מחבר, בלי לחכות לרענון מלא של הדף (בקשה מפורשת).
    setStoryRail((prev) =>
      prev?.map((entry) => {
        const stories = entry.stories.map((s) => (s.id === storyId ? { ...s, viewed: true } : s));
        return { ...entry, stories, hasUnviewed: stories.some((s) => !s.viewed) };
      }) ?? null
    );
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6">
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="mb-4 h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-places-bg pb-24">
      <PlacesHeader />

      <CreatePostBar avatarUrl={profile?.avatar_url} onClick={() => setCreateMenuOpen(true)} />

      <div className="bg-white">
        {storyRail === null ? (
          <div className="flex gap-4 px-4 py-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[60px] w-[60px] shrink-0 rounded-full" />
            ))}
          </div>
        ) : (
          <StoriesRail
            rail={storyRail}
            viewerId={user.id}
            viewerAvatarUrl={profile?.avatar_url}
            onOpenStory={handleOpenStory}
            onCreateStory={() => router.push("/places/story/create")}
          />
        )}
      </div>

      {suggestedTravelers !== null && <SuggestedPeopleCircles people={suggestedTravelers} />}

      {creators === null ? (
        <div className="px-4 py-3">
          <Skeleton className="mb-3 h-4 w-40" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-[150px] shrink-0" />
            ))}
          </div>
        </div>
      ) : (
        <CreatorsSection creators={creators} onFollowToggle={handleFollowToggle} />
      )}

      {onlineFriends === null ? (
        <div className="px-4 py-3">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-12 shrink-0 rounded-full" />
            ))}
          </div>
        </div>
      ) : (
        <OnlineFriendsSection friends={onlineFriends} />
      )}

      <div className="mt-2 bg-white">
        <FeedTabs active={feedTab} onChange={setFeedTab} />

        {feedItems === null && (
          <div className="p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-3 h-48 w-full" />
            ))}
          </div>
        )}

        {feedError && (
          <PlacesEmptyState title={feedError} actionLabel="נסה שוב" onAction={() => loadFeed(feedTab)} />
        )}

        {feedItems?.length === 0 && !feedError && (
          <PlacesEmptyState
            title={
              feedTab === "friends"
                ? "אין עדיין תוכן מחברים - עדיין אין לך חברים ב-place's"
                : "שתף את הרגע הראשון שלך"
            }
            actionLabel="צור פוסט"
            onAction={() => setCreatePostOpen(true)}
          />
        )}

        {feedItems && feedItems.length > 0 && (
          <div>
            {feedItems.map((item) => (
              <PostCard
                key={item.id}
                item={item}
                onLikeToggle={handleLikeToggle}
                onSaveToggle={handleSaveToggle}
                onOpenComments={handleOpenComments}
                onWriteReview={(placeId, placeName) => setReviewTarget({ placeId, placeName })}
                onEditPost={handleEditPost}
                onDeletePost={handleDeletePost}
              />
            ))}
            {nextCursor && (
              <button
                type="button"
                onClick={loadMoreFeed}
                disabled={feedLoadingMore}
                className="w-full py-4 text-[13px] font-semibold text-ink-secondary disabled:opacity-50"
              >
                {feedLoadingMore ? "טוען..." : "טען עוד"}
              </button>
            )}
          </div>
        )}
      </div>

      <MyDestinationsSection />

      <MainBottomNav active="places" />

      {storyViewerIndex !== null && storyRail && (
        <StoryViewerModal
          rail={storyRail}
          startAuthorIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
          onView={handleStoryViewed}
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

      {createMenuOpen && (
        <CreateMenuSheet
          onClose={() => setCreateMenuOpen(false)}
          onSelectPost={() => setCreatePostOpen(true)}
          onSelectReview={() => setReviewPickerOpen(true)}
          onSelectPlace={() => setSuggestPlaceOpen(true)}
          onSelectTrip={() => router.push("/tripmatch")}
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
            // מגיעים לכאן גם מ-CreateMenuSheet וגם מ"לא מצאתי" בתוך
            // ReviewPlacePickerSheet - ברירת המחדל היא לחזור לתפריט
            // הראשי, שזה נכון ברוב המקרים.
            setCreateMenuOpen(true);
          }}
        />
      )}

      {reviewTarget && (
        <CreateReviewSheet
          placeId={reviewTarget.placeId}
          placeName={reviewTarget.placeName}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => loadFeed(feedTab)}
          onBack={() => {
            setReviewTarget(null);
            setReviewPickerOpen(true);
          }}
        />
      )}
    </div>
  );
}
