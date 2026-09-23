"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { ProfileContentGrid } from "@/screens/places/ProfileContentGrid";
import { ProfileSocialLinks } from "@/screens/places/ProfileSocialLinks";
import { SocialLinkSheet } from "@/screens/places/SocialLinkSheet";
import { getAvatarUrl } from "@/constants/avatar";
import { DEFAULT_PROFILE_HERO_URL } from "@/constants/profileCover";
import type { SocialProfileDto } from "@/services/social/socialProfileService";
import type { SocialPlatform } from "@/services/social/socialLinks";
import type { ProfileTileDto } from "@/services/social/profileContentTypes";

const BLUE_GRADIENT = "linear-gradient(150deg, #22B8FD, #007CFE)";
const BLUE = "#0A6DFE";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה");
  }
  return res.json();
}

/**
 * תצוגת הפרופיל (Client): בר triplace · קאבר-מסגרת עם תמונת הפרופיל בטבעת · שם · קישורי אינסטגרם/טיקטוק ·
 * כפתורים (אצל אחרים: עקוב + הודעה, בכחול; אצלי: ערוך פרופיל) · סטטיסטיקה · תוכן (טאבים + Grid).
 *
 * *** מהירות (בקשה מפורשת - "הפרופיל נטען המון זמן"): הנתונים (הפרופיל + העמוד הראשון של התוכן) נשלפים בשרת
 * ב-page.tsx ומגיעים כבר בתוך ה-HTML - בלי fetch אחרי הטעינה ובלי מפל של בקשות (auth -> פרופיל -> תוכן).
 */
export default function ProfileView({
  username,
  initialProfile,
  initialContent,
}: {
  username: string;
  initialProfile: SocialProfileDto;
  initialContent: { tiles: ProfileTileDto[]; nextCursor: string | null } | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<SocialProfileDto>(initialProfile);
  const [busy, setBusy] = useState(false);
  const [socialSheet, setSocialSheet] = useState<SocialPlatform | null>(null);
  /** מפתח לרענון ה-Grid (קבוע כרגע - אין יותר יצירת תוכן מהעמוד הזה). */
  const [gridVersion] = useState(0);

  /** עקוב / עוקב - אותה מערכת follows הקיימת (POST/DELETE /api/social/follows). */
  async function handleFollowToggle() {
    if (!profile || busy) return;
    setBusy(true);
    const wasFollowing = profile.viewerState.following;
    try {
      if (wasFollowing) {
        await fetchJson(`/api/social/follows?userId=${encodeURIComponent(profile.id)}`, { method: "DELETE" });
      } else {
        await fetchJson("/api/social/follows", { method: "POST", body: JSON.stringify({ userId: profile.id }) });
      }
      setProfile((p) =>
        p
          ? {
              ...p,
              viewerState: { ...p.viewerState, following: !wasFollowing },
              counts: { ...p.counts, followers: Math.max(0, p.counts.followers + (wasFollowing ? -1 : 1)) },
            }
          : p
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSocial(platform: SocialPlatform, handle: string | null) {
    await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ [platform]: handle }) });
    setProfile((p) => (p ? { ...p, [platform]: handle } : p));
  }

  const isSelf = profile.viewerState.isSelf;
  const coverUrl = profile.coverUrl;
  const following = profile.viewerState.following;

  /** תמונת הפרופיל: עיגול *מושלם* מעל שכבת הטבעת (לא מתחתיה). *** תיקון (בקשה מפורשת - "יש לבן בצדדים, שהעיגול
   *  יהיה מושלם - אפילו אם תדביק מעליו את תמונת הפרופיל במיקום מושלם"): החור בטבעת שבקובץ המסגרת אינו עיגול מושלם
   *  (רדיוסו נע בין 20.5% ל-21.6% מרוחב הקאבר, ומרכזו 50.14%/69.04%), ולכן תמונה מתחתיו השאירה שוליים לבנים
   *  בצדדים. עכשיו התמונה *מעל* הטבעת: עיגול מושלם ברדיוס 21.85% (גדול מכל נקודה בחור) במרכז (50.08%, 69.03%) -
   *  מכסה את כל אי-הסדירות, והקצה הפנימי של הטבעת נהיה עיגול מושלם. רקע כחול מאחור - שוליים שקופים בתמונה
   *  נראים ככחול ולא כלבן. משותפת לשני מצבי הקאבר. */
  const avatarLayer = (
    <span
      className="absolute left-[50.08%] top-[69.03%] aspect-square w-[43.7%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
      style={{ background: BLUE }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getAvatarUrl(profile.avatarUrl)} alt="" className="h-full w-full object-cover" />
    </span>
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} menuHref={isSelf ? "/profile" : undefined} />

      {/* הקאבר: מתחיל מראש המסך ממש, מתחת לבר השקוף (-mt-16 = גובה הבר: 52px + pb-3), בלי פס לבן מעליו.
          כל המידות באחוזים מרוחב הקאבר. שני מצבים:
          א. בלי קאבר משלו: התמונה המלאה עם ה-HERO (profile-default-hero) -> תמונת הפרופיל מעליה.
          ב. עם קאבר משלו: המסגרת הריקה -> הקאבר כעיגול (70%, מרכז 50%/39.2%) -> הטבעת (profile-cover-ring, מעל הקאבר,
             ולכן חסר לקאבר חלק מתחת) -> תמונת הפרופיל. */}
      <div className="relative -mt-16 aspect-square w-full overflow-hidden bg-white">
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/profile-cover-ring.webp"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
            {avatarLayer}
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEFAULT_PROFILE_HERO_URL}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
            {avatarLayer}
          </>
        )}

      </div>

      <div className="px-4">
        {/* שם + שם משתמש, ממורכזים מתחת לקאבר. -mt-5 מושך אותם לתוך הרצפה הלבנה של המסגרת (רווח קטן מהטבעת);
            relative - כדי שיצבעו מעל תיבת הקאבר. */}
        <div className="relative -mt-5 flex justify-center">
          <div className="flex min-w-0 flex-col items-center gap-0.5 pb-1 text-center">
            <h2 className="flex items-baseline justify-center gap-1 truncate text-[17px] font-bold text-ink">
              {profile.fullName}
              {profile.isCreator && (
                <span className="ms-1" style={{ color: BLUE }}>
                  ✓
                </span>
              )}
            </h2>
            {profile.username && <span className="truncate text-[13px] text-ink-secondary">@{profile.username}</span>}
          </div>
        </div>

        {profile.bio && <p className="mt-2 text-center text-[13.5px] text-ink">{profile.bio}</p>}

        {/* אינסטגרם / טיקטוק: בפרופיל שלי - "הוסף ... +" (פיל מקווקו); אצל אחרים - רק מה שהוגדר */}
        <ProfileSocialLinks instagram={profile.instagram} tiktok={profile.tiktok} isSelf={isSelf} onEdit={setSocialSheet} />

        {/* *** בקשה מפורשת - "בעמודים של החברים (לא של המשתמש) בצבע כחול - עקוב - הודעה":
            כפתור "עקוב" (כחול מלא; אחרי עקיבה - "עוקב" בקו כחול) + "הודעה" (כחול בהיר). "עקוב" = מערכת follows הקיימת.
            *** "הודעה" מוביל ל-/places/chat - מסך הצ'אט עדיין לא נבנה (הוא מציג זאת בכנות), הפרמטר ?with= מוכן לעתיד. */}
        {!isSelf && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleFollowToggle}
              className="flex-1 rounded-pill py-2.5 text-[13.5px] font-bold disabled:opacity-60"
              style={following ? { border: `1.5px solid ${BLUE}`, color: BLUE, background: "#fff" } : { background: BLUE_GRADIENT, color: "#fff" }}
            >
              {following ? "עוקב" : "עקוב"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/places/chat?with=${encodeURIComponent(profile.username ?? profile.id)}`)}
              className="flex-1 rounded-pill py-2.5 text-[13.5px] font-bold"
              style={{ background: "#EAF3FF", color: BLUE, border: "1.5px solid #CFE2FF" }}
            >
              הודעה
            </button>
          </div>
        )}

        {isSelf && (
          <Link
            href="/places/profile/edit"
            className="mt-3 block w-full rounded-pill border border-ink-secondary/20 py-2 text-center text-[13px] font-bold text-ink"
          >
            ערוך פרופיל
          </Link>
        )}

        {/* סטטיסטיקה: מדיה (כל התוכן שבגריד: פוסטים, ביקורות, אוספים וטיולים) · עוקבים · במעקב */}
        <div className="mt-4 flex gap-5 border-y border-ink-secondary/10 py-3 text-center">
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.media}</div>
            <div className="text-[11.5px] text-ink-secondary">מדיה</div>
          </div>
          <Link href={`/places/profile/${encodeURIComponent(username)}/followers`} className="flex-1 transition active:opacity-60">
            <div className="text-[15px] font-bold text-ink">{profile.counts.followers}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקבים</div>
          </Link>
          <Link href={`/places/profile/${encodeURIComponent(username)}/following`} className="flex-1 transition active:opacity-60">
            <div className="text-[15px] font-bold text-ink">{profile.counts.following}</div>
            <div className="text-[11.5px] text-ink-secondary">במעקב</div>
          </Link>
        </div>
      </div>

      {/* התוכן: טאבים עם אייקון + Grid ללא שוליים (פוסטים, ביקורות, אוספים, טיולים - לכל סוג אייקון משלו) */}
      <ProfileContentGrid username={username} isSelf={isSelf} refreshKey={gridVersion} initialAll={initialContent} />

      <MainBottomNav active="profile" />

      {socialSheet && (
        <SocialLinkSheet
          platform={socialSheet}
          current={socialSheet === "instagram" ? profile.instagram : profile.tiktok}
          onClose={() => setSocialSheet(null)}
          onSave={(handle) => handleSaveSocial(socialSheet, handle)}
        />
      )}
    </div>
  );
}
