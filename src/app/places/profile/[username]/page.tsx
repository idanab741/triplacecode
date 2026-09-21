"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { MainBottomNav } from "@/components/MainBottomNav";
import { PostCard } from "@/screens/places/PostCard";
import { CollectionAlbumCard } from "@/screens/collections/CollectionAlbumCard";
import { TripAlbumCard } from "@/screens/trips/TripAlbumCard";
import { CollectionTypeSheet } from "@/screens/collections/CollectionTypeSheet";
import { CreateMenuSheet } from "@/screens/places/CreateMenuSheet";
import { CreatePostSheet } from "@/screens/places/CreatePostSheet";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import { getAvatarUrl } from "@/constants/avatar";
import { DEFAULT_PROFILE_HERO_URL } from "@/constants/profileCover";
import { useAuth } from "@/hooks/useAuth";
import type { SocialProfileDto } from "@/services/social/socialProfileService";
import type { FeedItemDto } from "@/services/social/feedService";
import type { CollectionCardDto } from "@/services/social/collectionTypes";
import type { TripCardDto } from "@/services/social/tripTypes";
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
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<"media" | "trips" | "collections" | "reviews">("media");
  // טאב "אוספים" (Collections) - נטען בפעם הראשונה שנכנסים אליו.
  const [collections, setCollections] = useState<CollectionCardDto[] | null>(null);
  const [collectionsNextCursor, setCollectionsNextCursor] = useState<string | null>(null);
  const [collectionsLoadingMore, setCollectionsLoadingMore] = useState(false);
  const [collectionTypeOpen, setCollectionTypeOpen] = useState(false);
  // טאב "טיולים" (Trips) - הטיולים שהמשתמש יצר ופרסם; נטען בפעם הראשונה שנכנסים אליו.
  const [trips, setTrips] = useState<TripCardDto[] | null>(null);
  const [tripsNextCursor, setTripsNextCursor] = useState<string | null>(null);
  const [tripsLoadingMore, setTripsLoadingMore] = useState(false);

  useEffect(() => {
    if (profile) {
      setCoverUrl(profile.coverUrl);
    }
  }, [profile]);

  // עריכה/הסרה של הקאבר עברו לעמוד "עריכת פרופיל" (/places/profile/edit) - בעמוד הזה הקאבר להצגה בלבד.

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

  useEffect(() => {
    setCollections(null);
    setCollectionsNextCursor(null);
    setTrips(null);
    setTripsNextCursor(null);
  }, [username]);

  useEffect(() => {
    if (activeProfileTab !== "trips" || trips !== null) return;
    fetchJson<{ trips: TripCardDto[]; nextCursor: string | null }>(`/api/social/profile/${username}/trips`)
      .then((r) => {
        setTrips(r.trips);
        setTripsNextCursor(r.nextCursor);
      })
      .catch(() => setTrips([]));
  }, [activeProfileTab, trips, username]);

  async function handleLoadMoreTrips() {
    if (!tripsNextCursor) return;
    setTripsLoadingMore(true);
    try {
      const r = await fetchJson<{ trips: TripCardDto[]; nextCursor: string | null }>(
        `/api/social/profile/${username}/trips?cursor=${encodeURIComponent(tripsNextCursor)}`
      );
      setTrips((prev) => [...(prev ?? []), ...r.trips]);
      setTripsNextCursor(r.nextCursor);
    } finally {
      setTripsLoadingMore(false);
    }
  }

  useEffect(() => {
    if (activeProfileTab !== "collections" || collections !== null) return;
    fetchJson<{ collections: CollectionCardDto[]; nextCursor: string | null }>(`/api/social/profile/${username}/collections`)
      .then((r) => {
        setCollections(r.collections);
        setCollectionsNextCursor(r.nextCursor);
      })
      .catch(() => setCollections([]));
  }, [activeProfileTab, collections, username]);

  async function handleLoadMoreCollections() {
    if (!collectionsNextCursor) return;
    setCollectionsLoadingMore(true);
    try {
      const r = await fetchJson<{ collections: CollectionCardDto[]; nextCursor: string | null }>(
        `/api/social/profile/${username}/collections?cursor=${encodeURIComponent(collectionsNextCursor)}`
      );
      setCollections((prev) => [...(prev ?? []), ...r.collections]);
      setCollectionsNextCursor(r.nextCursor);
    } finally {
      setCollectionsLoadingMore(false);
    }
  }

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

  // *** תיקון (בקשה מפורשת - "התגובות לא ייפתחו בעמוד נפרד"):
  // handleOpenComments (שניווט ל-/places/post/[id]) הוסר - PostCard
  // פותח עכשיו בעצמו מודל מסך-מלא + תגובות inline, בלי מעורבות של
  // העמוד הזה בכלל.

  async function handleEditPost(postId: string, newText: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ text: newText }) });
  }

  async function handleDeletePost(postId: string) {
    await fetchJson(`/api/social/posts/${postId}`, { method: "DELETE" });
    setPosts((prev) => prev?.filter((i) => i.id !== postId) ?? null);
  }

  async function handleCreatePost(text: string, visibility: PostVisibility, mediaIds: string[], placeId?: string | null) {
    await fetchJson("/api/social/posts", {
      method: "POST",
      body: JSON.stringify({ text, visibility, postType: mediaIds.length ? "photo" : "post", mediaIds, placeId: placeId ?? undefined }),
    });
    const { items, nextCursor } = await fetchJson<{ items: FeedItemDto[]; nextCursor: string | null }>(
      `/api/social/profile/${username}/posts`
    );
    setPosts(items);
    setPostsNextCursor(nextCursor);
  }

  // *** הוסר (בקשה מפורשת - "לבטל follow לגמרי, רק friends"):
  // handleFollowToggle. friend request (handleFriendAction, למטה)
  // מכסה עכשיו את כל הזרימה - הוסף חבר -> בקשה נשלחה -> חברים.

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

  /** תמונת הפרופיל בתוך הטבעת. *** תיקון (בקשה מפורשת - "הפרופיל נקי, בלי שום לבן מסביב - רק התמונה עצמה על המסגרת
   *  הכחולה"): נראה פס לבן בין התמונה לטבעת, כי תמונה שלא ממלאת את כל הריבוע שלה (למשל סטיקר עגול עם שוליים
   *  שקופים, או אווטאר ברירת המחדל עם קו לבן פנימי) השאירה את הרקע הבהיר של הקאבר נראה דרך חור הטבעת.
   *  עכשיו: (1) הרקע שמאחורי התמונה בכחול הטבעת - שוליים שקופים נראים ככחול ולא כלבן; (2) העיגול גדול יותר (46% מרוחב
   *  הקאבר; החור הפנימי ~42%, ועובי הטבעת עד ~49%) - הקצה שלו מוסתר מתחת לטבעת; (3) הגדלה של 6% בתוך העיגול - חותכת
   *  שוליים קטנים / קו לבן פנימי של התמונה. משותפת לשני מצבי הקאבר. */
  const avatarLayer = (
    <span
      className="absolute left-1/2 top-[68.9%] aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
      style={{ background: "#0A6DFE" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getAvatarUrl(profile.avatarUrl)} alt="" className="h-full w-full scale-[1.06] object-cover" />
    </span>
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* *** תיקון (בקשה מפורשת - "גם בעמוד פרופיל! הבר העליון של triplace ולא places"): הבר התכלת של triplace (אותו בר
          כמו בעמוד הבית): חזרה מימין, לוגו triplace במרכז, ובצד השני - בפרופיל שלי תפריט שלוש-הפסים (/profile) במקום
          הפעמון. הבר תופס מקום בזרימה, והקאבר מתחיל מתחתיו (מתחת לפינות המעוגלות שלו). */}
      <HomeStatusBarTint />
      <CollapsibleTopBar
        onBack={() => router.back()}
        menuHref={profile.viewerState.isSelf ? "/profile" : undefined}
      />

      {/* *** עיצוב-מחדש (בקשה מפורשת - "להחליף את הקאבר... התמונה ששלחתי תופיע עם הקאבר החדש"):
          הקאבר הוא עכשיו *מסגרת* (public/images/profile-cover-frame.webp) שמונחת מעל תמונת הקאבר של
          המשתמש. במסגרת יש שני חורים שקופים (העיגול הגדול והטבעת הכחולה) - תמונת הקאבר (או הגרדיאנט
          של ברירת המחדל, כשאין קאבר) נראית דרכם. לכן החלפת קאבר משנה רק את השכבה שמאחור, והמסגרת
          תמיד נשארת. *** תיקון (בקשה מפורשת - "כמו בתמונה ששלחתי! למה זה שונה?"): המסגרת מוצגת עכשיו
          במלואה, ריבוע מלא בדיוק כמו הקובץ (aspect-square, בלי חיתוך), ורקע ברירת המחדל מאחוריה
          לבן - כמו בתמונה המקורית - ולא גרדיאנט. קובץ המסגרת הוא WebP *ללא אובדן* (lossless), כי
          דחיסה עם אובדן יצרה שוליים כהים סביב החורים השקופים. */}
      {/* *** תיקון (בקשה מפורשת - "שהבר העליון יהיה קצת על התמונה, בלי רווח לבן ביניהם"): -mt-8 (32px, בדיוק
          רדיוס הפינות התחתונות של הבר - rounded-b-[32px]) מושך את הקאבר *מתחת* לבר. הבר sticky ב-z-30 ולכן
          נצבע מעליו, והפינות המעוגלות שלו חושפות את הקאבר ולא את הרקע הלבן של העמוד. */}
      <div className="relative -mt-8 aspect-square w-full overflow-hidden bg-white">
        {/* *** תיקון (בקשה מפורשת - "זאת התמונה! אם אני מסיר קאבר זה אמור להיות התמונה עם ה-HERO"):
            שני מצבים, שניהם עם אותה גיאומטריה (הכל באחוזים מרוחב הקאבר, ריבוע; מרכז הטבעת ב-(50%, 68.9%)):
            א. בלי קאבר משלו: *התמונה המלאה* (profile-default-hero.webp): הנוף בעיגול הגדול + ה-HERO שמחזיק
               את הטבעת הכחולה. חור הטבעת שקוף, ולכן תמונת הפרופיל (44.2%) יושבת *מתחת* לתמונה ונראית דרכו.
            ב. עם קאבר משלו: המסגרת הריקה (profile-cover-frame) -> הקאבר כעיגול (70%, מרכז 50%/39.2%) -> תמונת
               הפרופיל -> הטבעת (profile-cover-ring, חתך הטבעת מאותה תמונה - מעל הכל, ולכן הקאבר "נגוס" מתחת). */}
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/profile-cover-frame.webp"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
            <span className="absolute left-1/2 top-[39.2%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            </span>
            {avatarLayer}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/profile-cover-ring.webp"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
          </>
        ) : (
          <>
            {avatarLayer}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEFAULT_PROFILE_HERO_URL}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
          </>
        )}
        {/* "+" יצירת תוכן (רק בפרופיל שלי) - צמוד לטבעת, באותו מיקום/גודל שלה (49%) */}
        {profile.viewerState.isSelf && (
          <div className="pointer-events-none absolute left-1/2 top-[68.9%] aspect-square w-[49%] -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setCreateMenuOpen(true)}
              aria-label="צור תוכן חדש"
              className="pointer-events-auto absolute bottom-[4%] end-[4%] flex h-11 w-11 items-center justify-center rounded-full text-white shadow-soft"
              style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="px-4">
        {/* *** תיקון (בקשה מפורשת - "העיגול של הפלוס צריך להיות חיצוני
            וגדול יותר, לא בתוך התמונה, בצבע סגול שלנו - והוא מביא
            לעמוד צור תוכן חדש"): גיליתי שהבנתי לא נכון בסבב הקודם -
            ה"+" הזה הוא לא כפתור העלאת-תמונה בכלל (זה עבר לגמרי לעמוד
            עריכת הפרופיל הנפרד) - הוא פותח את CreateMenuSheet, בדיוק
            כמו כפתור "צור תוכן חדש" הישן. AvatarUploader/fluid הוסר
            מכאן לגמרי - עיגול תמונה רגיל (זהה לתצוגה אצל isSelf ואצל
            מבקר, "עמוד זהה למשתמשים אחרים" כמו שביקשת), עם "+" חיצוני
            צמוד לפינה התחתונה-חיצונית של העיגול (לא חופף אותו), 44px,
            צבע var(--color-places-purple). בלי X בכלל - מחיקת תמונה
            עברה לעמוד עריכת הפרופיל. */}
        {/* *** עיצוב-מחדש (בקשה מפורשת - "להעביר את השם משמאל לתמונת
            הפרופיל, לא מתחתיה - רק ה-BIO נשאר מתחת לתמונה", גם
            בפרופיל שלי וגם באחרים): שורה אחת - עיגול (שלא זז), ולידו
            (בצד שמאל, ב-RTL: הילד השני ב-DOM) שם מלא + username. */}
        {/* *** תיקון (בקשה מפורשת - "זה חותך את השם!!"): ה-mt- שלילי
            היה על כל השורה - זה משך גם את השם למעלה, לתוך האזור
            שנחתך ע"י תיבת הקאבר. עכשיו ה-mt- השלילי רק על העיגול
            עצמו (כמו שהיה קודם, לפני האיחוד) - השורה עצמה במקומה
            הרגיל, עם items-end כך שהשם מיושר לתחתית העיגול (האזור
            הגלוי, לא-חתוך שלו). */}
        {/* *** תיקון (בקשה מפורשת - "לא צריך את השלישי למטה!"): העיגול הנפרד של תמונת הפרופיל מתחת לקאבר
            הוסר. תמונת הפרופיל (והפלוס) יושבות עכשיו בתוך הטבעת הכחולה של המסגרת (ר' הקאבר למעלה) -
            ולכן השם ושם המשתמש ממורכזים מתחת לקאבר. */}
        {/* *** תיקון (בקשה מפורשת - "פחות רווח בין השם ושם המשתמש לתמונת הפרופיל"): מתחת לטבעת יש רצפה
            לבנה של המסגרת (~7% מגובה הקאבר), ולכן ה-mt- השלילי מושך את השם לתוכה - הטקסט כבר לא
            "צף" רחוק מהטבעת. relative נדרש כדי שהטקסט ייצבע *מעל* תיבת הקאבר (שגם היא relative).
            את הרווח משנים כאן: -mt-5 = 20px למעלה. */}
        <div className="relative -mt-5 flex justify-center">
          <div className="flex min-w-0 flex-col items-center gap-0.5 pb-1 text-center">
            <h2 className="flex items-baseline justify-center gap-1 truncate text-[17px] font-bold text-ink">
              {profile.fullName}
              {profile.isCreator && (
                <span className="ms-1" style={{ color: "var(--color-places-purple)" }}>
                  ✓
                </span>
              )}
            </h2>
            {/* *** תיקון (בקשה מפורשת - "היוזרניים צריך להיות גם מימין
                לשמאל!"): dir="ltr" הוסר - שם המשתמש (טקסט לטיני) זורם
                עכשיו בהקשר ה-RTL הכללי של הדף, לא כפוי ל-LTR בנפרד. */}
            {profile.username && <span className="truncate text-[13px] text-ink-secondary">@{profile.username}</span>}
          </div>
        </div>

        {/* *** תיקון (בקשה מפורשת - "עוקב/בקשה נשלחה זה אותו כפתור! לא
            צריך שתי מערכות" - בירור: follow ו-friend request היו שתי
            מערכות נפרדות לגמרי באפליקציה, כמו אינסטגרם מול פייסבוק -
            הוחלט לבטל follow לגמרי ולהשאיר רק friend request, שכבר
            עושה בדיוק את זה שביקשת: הוסף חבר -> בקשה נשלחה -> חברים). */}
        {!profile.viewerState.isSelf && (
          <div className="mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleFriendAction}
              className={`w-full rounded-pill px-3.5 py-2 text-[13px] font-bold disabled:opacity-50 ${
                profile.viewerState.friendStatus === "accepted" ? "text-white" : ""
              }`}
              style={
                profile.viewerState.friendStatus === "accepted"
                  ? { background: "var(--color-places-purple)" }
                  : { border: "1px solid var(--color-places-purple)", color: "var(--color-places-purple)" }
              }
            >
              {friendLabel}
            </button>
          </div>
        )}

        {/* *** תיקון (בקשה מפורשת - "הביו שאפשר לערוך אותו בכפתור ערוך
            פרופיל"): קודם הטקסטאריה הייתה תמיד פתוחה אצל isSelf - עכשיו
            ברירת המחדל היא תצוגה סטטית + כפתור "ערוך פרופיל", ומצב
            העריכה נפתח רק בלחיצה עליו (בדיוק כמו Edit profile
            באינסטגרם - לא שדה עריכה שיושב שם תמיד). */}
        {/* *** תיקון (בקשה מפורשת - "עריכת פרופיל צריכה להביא אותי
            לעמוד נוסף"): לא עוד toggle פנימי לעריכת ביו בלבד - "ערוך
            פרופיל" מנווט לעמוד עצמאי חדש (/places/profile/edit) עם כל
            השדות (שם משתמש/שם מלא/מייל/עיר/ביו/תאריך לידה/סיסמה/תמונה). */}
        {profile.bio && <p className="mt-2 text-[13.5px] text-ink">{profile.bio}</p>}
        {profile.viewerState.isSelf && (
          <Link
            href="/places/profile/edit"
            className="mt-3 block w-full rounded-pill border border-ink-secondary/20 py-2 text-center text-[13px] font-bold text-ink"
          >
            ערוך פרופיל
          </Link>
        )}

        {/* *** תיקון (בקשה מפורשת - "טיולים - עוקבים - במעקב", בסגנון
            אינסטגרם): הוחלף לגמרי מ"עוקבים/עוקב/חברים". "טיולים" הוא
            כרגע מספר הפוסטים שנטענו לעמוד הזה (posts.length) - אין
            עדיין ספירה ייעודית ל"טיולים" בבסיס הנתונים, זו קירוב-זמני
            הגון, לא הכפלה של ה-tab "טיולים" למטה (שגם הוא עדיין ללא
            תוכן ממשי משלו, ר' ההערה שם). */}
        {/* *** תיקון (בקשה מפורשת - "לבטל follow לגמרי, רק friends"):
            הוחלפו "עוקבים"+"במעקב" (שני stats שהתבססו על follow, מערכת
            שבוטלה) בstat יחיד - "חברים" (friendships, מערכת סימטרית -
            אין הבדל בין "עוקבים" ל"במעקב" כשזה הדדי). */}
        <div className="mt-4 flex gap-5 border-y border-ink-secondary/10 py-3 text-center">
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{posts?.length ?? 0}</div>
            <div className="text-[11.5px] text-ink-secondary">טיולים</div>
          </div>
          {/* *** תיקון (בקשה מפורשת - "לא צריך גם חברים וגם עוקבים/
              במעקב! רק עוקבים/במעקב"): הוסר "חברים" מהסטטיסטיקה -
              נשאר רק עוקבים/במעקב. כפתור הפעולה עצמו (הוסף חבר/בקשה
              נשלחה/חברים, למעלה) לא השתנה - זה שינוי בשורת הסטטיסטיקה
              בלבד, לא בזרימת הפעולה. */}
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.followers}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקבים</div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.following}</div>
            <div className="text-[11.5px] text-ink-secondary">במעקב</div>
          </div>
        </div>

        {/* *** תיקון (בקשה מפורשת - "לא צריך את כפתור צור תוכן חדש - יש
            אותו בפלוס"): הוסר לגמרי - ה"+" הצמוד לעיגול התמונה למעלה
            עושה בדיוק את זה עכשיו. */}
      </div>

      {/* *** תוספת (בקשה מפורשת - "החלוקה כמו שיש, עם מדיה-טיולים-
          ביקורות"): לא הייתה קודם שום מערכת טאבים אמיתית בעמוד הזה
          (רק כותרת "פוסטים" קבועה) - זו בנייה חדשה, בהשראת עיצוב
          הטאבים הקיים כבר ב-FeedTabs.tsx (עבורך/חברים) לעקביות ויזואלית.
          *** מגבלה שכדאי לדעת עליה: רק טאב "מדיה" מציג בפועל תוכן אמיתי
          כרגע (אותה רשימת הפוסטים שהייתה) - "טיולים" ו"ביקורות" הם
          placeholder בלבד, כי אין עדיין הפרדת-תוכן אמיתית בין הסוגים
          האלה במסד הנתונים/ב-API. */}
      <div className="mt-4 flex justify-center gap-6 border-t border-ink-secondary/10 pt-2">
        {(
          [
            { id: "media", label: "מדיה" },
            { id: "trips", label: "טיולים" },
            { id: "collections", label: "אוספים" },
            { id: "reviews", label: "ביקורות" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveProfileTab(tab.id)}
            className="relative pb-2.5 pt-1.5 text-[13.5px] font-bold transition-colors"
            style={{ color: activeProfileTab === tab.id ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
          >
            {tab.label}
            {activeProfileTab === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full" style={{ background: "var(--color-places-purple)" }} />
            )}
          </button>
        ))}
      </div>

      {activeProfileTab === "trips" ? (
        <div className="px-4 pt-4">
          {trips === null && (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-card" />
              ))}
            </div>
          )}
          {trips !== null && trips.length === 0 && (
            <p className="py-10 text-center text-[13px] text-ink-secondary">
              {profile.viewerState.isSelf ? "עוד לא יצרתם טיול - לחצו על ה־+ כדי ליצור את הראשון." : "אין עדיין טיולים להצגה כאן."}
            </p>
          )}
          {trips !== null && trips.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {trips.map((t) => (
                  <TripAlbumCard key={t.id} item={t} />
                ))}
              </div>
              {tripsNextCursor && (
                <button
                  type="button"
                  onClick={handleLoadMoreTrips}
                  disabled={tripsLoadingMore}
                  className="w-full py-4 text-[13px] font-semibold text-ink-secondary disabled:opacity-50"
                >
                  {tripsLoadingMore ? "טוען..." : "טען עוד"}
                </button>
              )}
            </>
          )}
        </div>
      ) : activeProfileTab === "collections" ? (
        <div className="px-4 pt-4">
          {collections === null && (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-card" />
              ))}
            </div>
          )}
          {collections !== null && collections.length === 0 && (
            <p className="py-10 text-center text-[13px] text-ink-secondary">
              {profile.viewerState.isSelf ? "עוד לא יצרתם אוסף - לחצו על ה־+ כדי ליצור את הראשון." : "אין עדיין אוספים להצגה כאן."}
            </p>
          )}
          {collections !== null && collections.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {collections.map((c) => (
                  <CollectionAlbumCard key={c.id} item={c} />
                ))}
              </div>
              {collectionsNextCursor && (
                <button
                  type="button"
                  onClick={handleLoadMoreCollections}
                  disabled={collectionsLoadingMore}
                  className="w-full py-4 text-[13px] font-semibold text-ink-secondary disabled:opacity-50"
                >
                  {collectionsLoadingMore ? "טוען..." : "טען עוד"}
                </button>
              )}
            </>
          )}
        </div>
      ) : activeProfileTab !== "media" ? (
        <p className="py-10 text-center text-[13px] text-ink-secondary">
          הביקורות יופיעו כאן בקרוב
        </p>
      ) : (
      <div className="mt-2 px-3 pt-3">
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
      )}

      <MainBottomNav active="profile" />

      {createMenuOpen && (
        <CreateMenuSheet
          onClose={() => setCreateMenuOpen(false)}
          onSelectPost={() => setCreatePostOpen(true)}
          // "מקום": עמודים מלאים עם הבר העליון של Places - /places/create (בחירה/הוספת מקום) ואז /places/create/review.
          onSelectPlace={() => router.push("/places/create")}
          onSelectCollection={() => {
            setCreateMenuOpen(false);
            setCollectionTypeOpen(true);
          }}
          // "טיול": עמוד יצירת טיול (place's Trips) - מסלול של תחנות בסדר, עם ימים.
          onSelectTrip={() => router.push("/places/trip/create")}
        />
      )}

      {collectionTypeOpen && (
        <CollectionTypeSheet
          onClose={() => setCollectionTypeOpen(false)}
          onSelect={(type) => router.push(`/places/collection/create?type=${type}`)}
        />
      )}

      {createPostOpen && (
        <CreatePostSheet
          onClose={() => setCreatePostOpen(false)}
          onSubmit={handleCreatePost}
        />
      )}



      {reviewTarget && (
        <CreateReviewSheet
          placeId={reviewTarget.placeId}
          placeName={reviewTarget.placeName}
          onClose={() => setReviewTarget(null)}
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
