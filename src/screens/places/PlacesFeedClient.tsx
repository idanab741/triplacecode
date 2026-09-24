"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CreatorsSection } from "@/screens/places/CreatorsSection";
import { SuggestedPeopleCircles } from "@/screens/places/SuggestedPeopleCircles";
import { MyDestinationsSection } from "@/screens/places/MyDestinationsSection";
import { FeedTabs } from "@/screens/places/FeedTabs";
import { FeedPromoStrip } from "@/screens/places/FeedPromoStrip";
import { PostCard } from "@/screens/places/PostCard";
import { CollectionFeedCard } from "@/screens/collections/CollectionFeedCard";
import { TripFeedCard } from "@/screens/trips/TripFeedCard";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import { PlacesHeaderRow } from "@/screens/places/PlacesHeaderRow";
import { PlacesTopBarCreate } from "@/screens/places/PlacesTopBarCreate";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CreateMenuSheet } from "@/screens/places/CreateMenuSheet";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import type { FeedTab } from "@/services/social/feedService";
import type { FeedEntryDto } from "@/services/social/collectionTypes";
import type { PlacesFeedView } from "@/screens/places/FeedTabs";
import type { CreatorCardDto } from "@/services/social/creatorDiscoveryService";
import type { SuggestedTravelerDto } from "@/services/social/suggestedTravelersService";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה בטעינת הנתונים");
  }
  return res.json();
}

/**
 * *** בקשה מפורשת ("נראה דהוי"): גווני טקסט חדים יותר לעמוד הבית בלבד. הטוקנים הגלובליים
 * (ink כחלחל-כהה #1a1a2e, ink-secondary אפור-בהיר #8a8fa3) נותנים מראה חלבי; כאן מוחלפים
 * לשחור-ניטרלי וטקסט משני כהה יותר, כמו ב-X/אינסטגרם. כל text-ink / text-ink-secondary
 * בתוך העמוד מקבלים את זה אוטומטית (CSS variables), בלי לגעת בשאר האפליקציה.
 */
const HOME_INK = {
  "--color-ink": "#0f1419",
  "--color-ink-secondary": "#5b6472",
} as CSSProperties;

interface PlacesFeedClientProps {
  /** המשתמש שכבר אומת בשרת (page.tsx) - נמנע מהמתנה ל-AuthProvider בצד הלקוח בטעינה הראשונה. */
  initialUser: User;
  /** עמוד ה-Feed הראשון, שכבר נשלף בשרת יחד עם ה-HTML - הפיד מוצג *מיד*, בלי round-trip נוסף. */
  initialEntries: FeedEntryDto[];
  initialNextCursor: string | null;
}

export function PlacesFeedClient({ initialUser, initialEntries, initialNextCursor }: PlacesFeedClientProps) {
  const { user: contextUser, loading: authLoading } = useAuth();
  const router = useRouter();
  // *** ביצועים: כל עוד ה-AuthProvider בצד הלקוח עוד לא סיים את ה-getSession() שלו,
  // ממשיכים עם המשתמש שכבר קיבלנו מהשרת - כדי שהעמוד לא "יחכה" מיותר לאותו מידע פעמיים.
  const user = contextUser ?? initialUser;
  const effectiveAuthLoading = authLoading && !initialUser;

  const [creators, setCreators] = useState<CreatorCardDto[] | null>(null);
  const [suggestedTravelers, setSuggestedTravelers] = useState<SuggestedTravelerDto[] | null>(null);
  // *** הפיד מכיל פוסטים *ו*אוספים (Collections) ממוזגים לפי זמן - ר' feedPageService.ts.
  // מגיע כבר מלא מהשרת (initialEntries) - לא null - כך שאין הבהוב של שלד בטעינה הראשונה.
  const [feedItems, setFeedItems] = useState<FeedEntryDto[] | null>(initialEntries);
  // *** "עבורך / חברים" (בקשה מפורשת): הפיד עבר לעמוד הבית, והמפה יצאה ממנו
  // (היא עמוד place's עכשיו - PlacesMapClient). כל לשונית טוענת את הפיד שלה.
  const [view, setView] = useState<PlacesFeedView>("for_you");
  const feedTab: FeedTab = view;
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);
  const [comingSoonMessage, setComingSoonMessage] = useState<string | null>(null);
  function showComingSoon(message: string) {
    setComingSoonMessage(message);
    setTimeout(() => setComingSoonMessage(null), 2500);
  }

  useEffect(() => {
    if (!effectiveAuthLoading && !user) router.replace("/auth/login");
  }, [effectiveAuthLoading, user, router]);

  // אחרי פרסום ביקורת (/places/create) חוזרים לכאן עם ?published=1 - הודעת הצלחה קצרה.
  // הפיד נטען מחדש ממילא בכניסה לעמוד, והביקורת החדשה מופיעה בראשו.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("published") === "1") {
      showComingSoon("הביקורת פורסמה 🎉");
      router.replace("/home");
    } else if (params.get("published") === "post") {
      // אחרי פרסום פוסט (/places/post/create) - הפיד נטען מחדש ממילא והפוסט מופיע בראשו.
      showComingSoon("הפוסט פורסם 🎉");
      router.replace("/home");
    } else if (params.get("create") === "1") {
      // תפריט היצירה ("מה בא לכם ליצור?") - נשאר נתמך לקישורים ישנים.
      setCreateMenuOpen(true);
      router.replace("/home");
    } else if (params.get("create") === "post") {
      // קישורים ישנים (/places?create=post) - ממשיכים לעמוד יצירת הפוסט.
      router.replace("/places/post/create");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = useCallback(async (tab: FeedTab) => {
    setFeedItems(null);
    setFeedError(null);
    try {
      const { entries, nextCursor } = await fetchJson<{ entries: FeedEntryDto[]; nextCursor: string | null }>(
        `/api/social/feed?tab=${tab}`
      );
      setFeedItems(entries);
      setNextCursor(nextCursor);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "שגיאה בטעינת ה-Feed");
      setFeedItems([]);
    }
  }, []);

  // *** ביצועים: ה-props כבר מכילים את עמוד ה-Feed הראשון (נשלף בשרת, ר' page.tsx) -
  // אז בטעינה הראשונה מדלגים על קריאת הרשת החוזרת הזו לגמרי (ref כדי שזה יקרה פעם אחת בלבד).
  const skippedInitialLoad = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (!skippedInitialLoad.current) {
      skippedInitialLoad.current = true;
      return;
    }
    loadFeed(feedTab);
  }, [user, feedTab, loadFeed]);

  useEffect(() => {
    if (!user) return;
    fetchJson<{ creators: CreatorCardDto[] }>("/api/social/creators").then((r) => setCreators(r.creators)).catch(() => setCreators([]));
    fetchJson<{ travelers: SuggestedTravelerDto[] }>("/api/social/suggested-travelers")
      .then((r) => setSuggestedTravelers(r.travelers))
      .catch(() => setSuggestedTravelers([]));
    // *** "מחוברים עכשיו" הועבר לעמוד הצ'אטים בלבד (בקשה מפורשת) - הוסר מכאן.
    // ה-heartbeat עצמו נשאר: הוא זה שמעדכן את ה-last_seen של המשתמש הנוכחי,
    // ונדרש בלי קשר לאיפה הפיצ'ר *מוצג*.
    fetch("/api/social/presence/heartbeat", { method: "POST" }).catch(() => {});
  }, [user]);

  async function loadMoreFeed() {
    if (!nextCursor || feedLoadingMore) return;
    setFeedLoadingMore(true);
    try {
      const { entries, nextCursor: newCursor } = await fetchJson<{ entries: FeedEntryDto[]; nextCursor: string | null }>(
        `/api/social/feed?tab=${feedTab}&cursor=${encodeURIComponent(nextCursor)}`
      );
      setFeedItems((prev) => [...(prev ?? []), ...entries]);
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

  // *** תיקון (בקשה מפורשת - "התגובות לא ייפתחו בעמוד נפרד"):
  // handleOpenComments (שניווט ל-/places/post/[id]) הוסר - PostCard
  // פותח עכשיו מודל מסך-מלא פנימי בעצמו (PostMediaViewerModal), בלי
  // מעורבות של העמוד הזה בכלל.

  async function handleEditPost(postId: string, newText: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ text: newText }) });
  }

  async function handleDeletePost(postId: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "DELETE" });
    setFeedItems((prev) => prev?.filter((e) => !(e.kind === "post" && e.item.id === postId)) ?? null);
  }

  if (effectiveAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6">
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="mb-4 h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24" style={HOME_INK}>
      <HomeStatusBarTint color="#ffffff" solidBackground />
      {/* *** בקשה מפורשת - "החלק העליון כמו בעמוד הבית, המיקום זהה, ושורת החיפוש
          ב-place's עם תפקיד אחר": אותו רכיב בדיוק כמו הבר של triplace (מיקום/מידות/
          נדבק/מתכווץ בגלילה), עם שורת "צור תוכן חדש" + חיפוש place's במקום החיפוש. */}
      {/* *** בקשה מפורשת - "רקע לבן, רק הטקסט places בסגול": הבר השקוף
          (על רקע העמוד הבהיר), לוגו places בסגול. */}
      <CollapsibleTopBar headerRow={<PlacesHeaderRow badgeTone="purple" logo="triplace" plain />}>
        <PlacesTopBarCreate variant="flat" placeholder="חיפוש מטיילים" onCreate={() => setCreateMenuOpen(true)} />
      </CollapsibleTopBar>


      {/* הטאבים "עבורך / חברים" - צמודים מתחת לבר הסגול. */}
      <div className="mt-3">
        <FeedTabs active={view} onChange={setView} />
      </div>

      {/* *** בקשה מפורשת - פס באנרים נגלל (כמו ה"is live" של X): "תפתיעו אותי" + RunTrippy. */}
      <FeedPromoStrip />

        <>
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


      {/* הפיד: שטוח ולבן ברוחב מלא, כמו פידים מוכרים (בקשה מפורשת - "נראה מצועצע"). */}
      {/* *** בקשה מפורשת - "הרקע של העמוד כמו הרקע של הבר": בלי bg-white -
          הפיד יושב על אותו רקע כמו הבר העליון (bg-white של העמוד). */}
      <div>

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
            title="שתף את הרגע הראשון שלך"
            actionLabel="צור פוסט"
            onAction={() => router.push("/places/post/create")}
          />
        )}

        {feedItems && feedItems.length > 0 && (
          <div>
            {feedItems.map((entry) =>
              entry.kind === "collection" ? (
                <CollectionFeedCard key={`collection-${entry.item.id}`} item={entry.item} />
              ) : entry.kind === "trip" ? (
                <TripFeedCard key={`trip-${entry.item.id}`} item={entry.item} />
              ) : (
                <PostCard
                  key={entry.item.id}
                  item={entry.item}
                  onLikeToggle={handleLikeToggle}
                  onSaveToggle={handleSaveToggle}
                  onWriteReview={(placeId, placeName) => setReviewTarget({ placeId, placeName })}
                  onEditPost={handleEditPost}
                  onDeletePost={handleDeletePost}
                />
              )
            )}
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
        </>

      <MainBottomNav active="home" />

      {createMenuOpen && (
        <CreateMenuSheet
          onClose={() => setCreateMenuOpen(false)}
          onSelectPost={() => router.push("/places/post/create")}
          // "מקום": עמוד מלא אחד (/places/create) - חיפוש, הוספת מקום וביקורת נחשפים שלב אחרי שלב.
          onSelectPlace={() => router.push("/places/create")}
          onSelectTrip={() => router.push("/places/trip/create")}
        />
      )}

      {comingSoonMessage && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-pill bg-ink px-4 py-3 text-center text-[13px] font-semibold text-white shadow-soft">
          {comingSoonMessage}
        </div>
      )}



      {reviewTarget && (
        <CreateReviewSheet
          placeId={reviewTarget.placeId}
          placeName={reviewTarget.placeName}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => loadFeed(feedTab)}
        />
      )}
    </div>
  );
}
