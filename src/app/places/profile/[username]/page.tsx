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
import { getAvatarUrl } from "@/constants/avatar";
import { uploadSocialMedia } from "@/services/social/mediaUploadService";
import { createClient } from "@/services/supabase/client";
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
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  // *** תוספת (בקשה מפורשת - עיצוב מחדש בסגנון אינסטגרם):
  // scrolled שולט על מתי הבר העליון עובר משקוף (מעל הקאבר) ללבן אטום.
  const [scrolled, setScrolled] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<"media" | "trips" | "reviews">("media");
  // *** תוספת (בקשה מפורשת - "טיול חדש בקרוב"): הודעה קצרה שנעלמת
  // לבד, במקום alert() דפדפן גס.
  const [comingSoonMessage, setComingSoonMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 24);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (profile) {
      setCoverUrl(profile.coverUrl);
    }
  }, [profile]);

  async function handleCoverFileChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingCover(true);
    try {
      const supabase = createClient();
      const uploaded = await uploadSocialMedia(supabase, user.id, file);
      setCoverUrl(uploaded.url);
      await fetchJson("/api/social/profile/me", {
        method: "PATCH",
        body: JSON.stringify({ coverUrl: uploaded.url }),
      });
    } finally {
      setUploadingCover(false);
    }
  }

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

  return (
    <div className="min-h-screen bg-white pb-24">
      <PlacesHeader
        onBack={() => router.back()}
        transparent={!scrolled}
        overlay
        menuHref={profile.viewerState.isSelf ? "/profile" : undefined}
      />

      {/* *** תיקון (בקשה מפורשת - "הקאבר צריך לכסות גם את הבר העליון
          כשהוא שקוף, עד שגוללים ואז הוא לבן"): הקאבר מתחיל מ-y=0 (אין
          עוד ריווח-פיצוי מעל, כי הבר עצמו fixed/מחוץ לזרימה) - כך
          שהוא נמצא *מתחת* לבר, לא אחריו. גובה גדל קצת (h-40 במקום
          h-28) כדי שיהיה מקום נשימה אמיתי מתחת לבר השקוף. */}
      <div className="relative h-40 w-full bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
        {profile.viewerState.isSelf && (
          <label className="absolute bottom-2 end-2 flex cursor-pointer items-center gap-1.5 rounded-pill bg-black/50 px-3 py-1.5 text-[11.5px] font-semibold text-white">
            {uploadingCover ? "מעלה..." : "החלף קאבר"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingCover}
              onChange={(e) => handleCoverFileChange(e.target.files?.[0])}
            />
          </label>
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
        <div className="flex items-end gap-3">
          <div className="relative -mt-14 h-32 w-32 shrink-0">
            <span className="block h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-bg-secondary shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(profile.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
            {profile.viewerState.isSelf && (
              <button
                type="button"
                onClick={() => setCreateMenuOpen(true)}
                aria-label="צור תוכן חדש"
                className="absolute -bottom-1 -end-1 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-soft"
                style={{ background: "var(--color-places-purple)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-2">
            <h2 className="flex items-baseline gap-1 truncate text-[17px] font-bold text-ink">
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

      {activeProfileTab !== "media" ? (
        <p className="py-10 text-center text-[13px] text-ink-secondary">
          {activeProfileTab === "trips" ? "תוכן הטיולים יופיע כאן בקרוב" : "הביקורות יופיעו כאן בקרוב"}
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
            setComingSoonMessage("אוספים יגיעו בקרוב!");
            setTimeout(() => setComingSoonMessage(null), 2500);
          }}
          // *** תיקון (בקשה מפורשת - "טיול חדש (בקרוב)"): לא עוד ניווט
          // ל-tripmatch - הודעה קצרה שנעלמת לבד.
          onSelectTrip={() => {
            setCreateMenuOpen(false);
            setComingSoonMessage("בניית טיולים תגיע בקרוב!");
            setTimeout(() => setComingSoonMessage(null), 2500);
          }}
        />
      )}

      {comingSoonMessage && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-pill bg-ink px-4 py-3 text-center text-[13px] font-semibold text-white shadow-soft">
          {comingSoonMessage}
        </div>
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
