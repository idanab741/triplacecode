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
import { AvatarUploader } from "@/components/AvatarUploader";
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
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [suggestPlaceOpen, setSuggestPlaceOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ placeId: string; placeName: string } | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  // *** תוספת (בקשה מפורשת - עיצוב מחדש בסגנון אינסטגרם):
  // scrolled שולט על מתי הבר העליון עובר משקוף (מעל הקאבר) ללבן אטום.
  const [scrolled, setScrolled] = useState(false);
  // הביו מוצג כטקסט קבוע כברירת מחדל - נכנס למצב עריכה רק בלחיצה על
  // "ערוך פרופיל" (לא תמיד פתוח כמו קודם).
  const [editingBio, setEditingBio] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<"media" | "trips" | "reviews">("media");

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
      setBioDraft(profile.bio ?? "");
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

  async function handleBioBlur() {
    if (!profile || bioDraft === (profile.bio ?? "")) return;
    setSavingBio(true);
    try {
      await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ bio: bioDraft }) });
      setProfile((p) => (p ? { ...p, bio: bioDraft } : p));
    } finally {
      setSavingBio(false);
    }
  }

  async function handleBioSaveAndClose() {
    await handleBioBlur();
    setEditingBio(false);
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
      <PlacesHeader onBack={() => router.back()} transparent={!scrolled} overlay menuHref="/profile" />

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
        {/* *** תיקון (בקשה מפורשת - "העיגול קטן מדי" + "+/מחיקה - עיגול
            קטן שמוצמד לפינת התמונה, כמו אינסטגרם"): 104px -> 128px,
            ומצב fluid של AvatarUploader (שכבר בנוי בדיוק לאפקט הזה -
            תגי +/מחיקה כעיגולים קטנים בפינות, לא כפתורים נפרדים
            מתחת) במקום המצב הרגיל. */}
        <div className="-mt-14 flex items-end justify-between">
          {profile.viewerState.isSelf && user ? (
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-soft">
              <AvatarUploader
                userId={user.id}
                initialUrl={profile.avatarUrl}
                fluid
                bordered={false}
                onUploaded={(url) => setProfile((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
                onRemoved={() => setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev))}
              />
            </div>
          ) : (
            <span className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white bg-bg-secondary shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(profile.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
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

        {!profile.viewerState.isSelf && (
          <div className="mt-3">
            <div className="flex gap-2">
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
          </div>
        )}

        {/* *** תיקון (בקשה מפורשת - "הביו שאפשר לערוך אותו בכפתור ערוך
            פרופיל"): קודם הטקסטאריה הייתה תמיד פתוחה אצל isSelf - עכשיו
            ברירת המחדל היא תצוגה סטטית + כפתור "ערוך פרופיל", ומצב
            העריכה נפתח רק בלחיצה עליו (בדיוק כמו Edit profile
            באינסטגרם - לא שדה עריכה שיושב שם תמיד). */}
        {profile.viewerState.isSelf ? (
          editingBio ? (
            <div className="mt-2">
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="קצת עליי..."
                rows={2}
                autoFocus
                className="w-full resize-none rounded-card border border-ink-secondary/15 p-2.5 text-[13.5px] text-ink placeholder:text-ink-secondary/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBioSaveAndClose}
                  disabled={savingBio}
                  className="rounded-pill px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--color-places-purple)" }}
                >
                  {savingBio ? "שומר..." : "שמירה"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBioDraft(profile.bio ?? "");
                    setEditingBio(false);
                  }}
                  className="rounded-pill px-3.5 py-1.5 text-[12px] font-semibold text-ink-secondary"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <>
              {profile.bio && <p className="mt-2 text-[13.5px] text-ink">{profile.bio}</p>}
              <button
                type="button"
                onClick={() => setEditingBio(true)}
                className="mt-3 w-full rounded-pill border border-ink-secondary/20 py-2 text-[13px] font-bold text-ink"
              >
                ערוך פרופיל
              </button>
            </>
          )
        ) : (
          profile.bio && <p className="mt-2 text-[13.5px] text-ink">{profile.bio}</p>
        )}

        {/* *** תיקון (בקשה מפורשת - "טיולים - עוקבים - במעקב", בסגנון
            אינסטגרם): הוחלף לגמרי מ"עוקבים/עוקב/חברים". "טיולים" הוא
            כרגע מספר הפוסטים שנטענו לעמוד הזה (posts.length) - אין
            עדיין ספירה ייעודית ל"טיולים" בבסיס הנתונים, זו קירוב-זמני
            הגון, לא הכפלה של ה-tab "טיולים" למטה (שגם הוא עדיין ללא
            תוכן ממשי משלו, ר' ההערה שם). */}
        <div className="mt-4 flex gap-5 border-y border-ink-secondary/10 py-3 text-center">
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{posts?.length ?? 0}</div>
            <div className="text-[11.5px] text-ink-secondary">טיולים</div>
          </div>
          <Link href={`/places/profile/${username}/followers`} className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.followers}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקבים</div>
          </Link>
          <Link href={`/places/profile/${username}/following`} className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.following}</div>
            <div className="text-[11.5px] text-ink-secondary">במעקב</div>
          </Link>
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
