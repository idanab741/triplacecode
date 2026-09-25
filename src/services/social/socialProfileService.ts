import type { SupabaseClient } from "@supabase/supabase-js";
import { getFollowCounts, isFollowing } from "./followService";
import { getFriendshipStatus, getFriendsCount } from "./friendService";
import { normalizeSocialHandle } from "./socialLinks";
import { usernameLockedMessage, usernameLockedUntil } from "./usernameLimit";

export interface SocialProfileDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  website: string | null;
  /** handle בלי @ (migration 0091) */
  instagram: string | null;
  tiktok: string | null;
  isCreator: boolean;
  /** מאומת ע"י האדמין (migration 0098) - וי כחול ליד השם */
  isVerified: boolean;
  profileVisibility: "public" | "private";
  /** media = כל התוכן שהצופה רשאי לראות אצל המשתמש הזה, כמו בגריד: פוסטים + ביקורות + אוספים + טיולים. */
  counts: { followers: number; following: number; friends: number; media: number };
  viewerState: {
    isSelf: boolean;
    following: boolean;
    friendStatus: "none" | "pending" | "accepted" | "declined" | "blocked";
    friendshipId: string | null;
    isRequester: boolean;
  };
}

/** מביא פרופיל מלא לפי username, עם viewerState מחושב מול viewerId.
 *  ה-RLS על profiles כבר קובע אם השורה בכלל נגישה (public/creator/self). */
export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string,
  viewerId: string | null
): Promise<SocialProfileDto | null> {
  const BASE_COLUMNS = "id, username, full_name, avatar_url, cover_url, bio, website, is_creator, profile_visibility";
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`${BASE_COLUMNS}, instagram, tiktok, is_verified`)
    .ilike("username", username)
    .maybeSingle();
  if (profileError) {
    // *** עמודות instagram/tiktok (migration 0091) עוד לא קיימות אצל מי שלא הריץ את המיגרציה - בלי fallback כל
    // הפרופילים היו מחזירים "פרופיל לא נמצא". חוזרים לשאילתה הבסיסית; הקישורים פשוט לא יוצגו עד שהמיגרציה תרוץ.
    ({ data: profile } = await supabase.from("profiles").select(BASE_COLUMNS).ilike("username", username).maybeSingle());
  }
  if (!profile) return null;

  // *** מהירות: כל השאילתות התלויות ב-profile.id רצות במקביל (סבב רשת אחד), ולא בזו אחר זו.
  const [followCounts, friends, postsRes, collectionsRes, tripsRes, following, friendship] = await Promise.all([
    getFollowCounts(supabase, profile.id),
    getFriendsCount(supabase, profile.id),
    // ספירת "מדיה" = מה שמופיע בגריד: פוסטים (כולל ביקורות) + אוספים + טיולים. ה-RLS של כל טבלה מסנן תוכן שהצופה לא
    // רשאי לראות (פרטי/חברים). טבלה שהמיגרציה שלה עוד לא הורצה (collections 0089 / trips 0090) - count=null -> 0.
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", profile.id).is("deleted_at", null),
    supabase.from("collections").select("id", { count: "exact", head: true }).eq("author_id", profile.id),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("author_id", profile.id),
    viewerId && viewerId !== profile.id ? isFollowing(supabase, viewerId, profile.id) : Promise.resolve(false),
    viewerId && viewerId !== profile.id ? getFriendshipStatus(supabase, viewerId, profile.id) : Promise.resolve(null),
  ]);
  const counts = {
    followers: followCounts.followers,
    following: followCounts.following,
    friends,
    media: (postsRes.count ?? 0) + (collectionsRes.count ?? 0) + (tripsRes.count ?? 0),
  };

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    coverUrl: profile.cover_url,
    bio: profile.bio,
    website: profile.website,
    instagram: profile.instagram ?? null,
    tiktok: profile.tiktok ?? null,
    isCreator: profile.is_creator,
    isVerified: Boolean((profile as { is_verified?: boolean | null }).is_verified),
    profileVisibility: profile.profile_visibility,
    counts,
    viewerState: {
      isSelf: viewerId === profile.id,
      following,
      friendStatus: friendship?.status ?? "none",
      friendshipId: friendship?.id ?? null,
      isRequester: friendship?.isRequester ?? false,
    },
  };
}

/** קובע/מעדכן username. ולידציה בסיסית כאן, הפורמט/ייחודיות נאכפים גם ב-DB. */
export async function setUsername(supabase: SupabaseClient, userId: string, username: string): Promise<void> {
  const normalized = username.trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalized)) {
    throw new Error("שם משתמש חייב להיות 3-30 תווים: אותיות באנגלית, ספרות וקו תחתון בלבד");
  }

  // *** בקשה מפורשת - "שם משתמש אפשר לשנות רק פעם בחודש": בדיקה כאן (הודעה ברורה עם התאריך), ובנוסף trigger ב-DB
  // (migration 0092) שאוכף אותו דבר גם מול קריאה ישירה. אם העמודה עוד לא קיימת (המיגרציה לא הורצה) - מדלגים על הבדיקה.
  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("username, username_changed_at")
    .eq("id", userId)
    .maybeSingle();
  if (!currentError && current?.username) {
    if (current.username.toLowerCase() === normalized.toLowerCase()) return; // אותו שם - אין שינוי
    const lockedUntil = usernameLockedUntil(current.username_changed_at);
    if (lockedUntil) throw new Error(usernameLockedMessage(lockedUntil));
  }

  const { error } = await supabase.from("profiles").update({ username: normalized }).eq("id", userId);
  if (error) {
    if (error.code === "23505") throw new Error("שם המשתמש הזה כבר תפוס");
    if (error.code === "P0001") throw new Error(error.message); // ה-trigger של הגבלת השינוי
    throw error;
  }
}

export async function updateSocialProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: {
    bio?: string;
    coverUrl?: string | null;
    website?: string;
    /** קלט חופשי (handle / @handle / קישור); "" או null = הסרה. */
    instagram?: string | null;
    tiktok?: string | null;
    profileVisibility?: "public" | "private";
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.bio !== undefined) payload.bio = updates.bio;
  if (updates.coverUrl !== undefined) payload.cover_url = updates.coverUrl;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.instagram !== undefined) payload.instagram = normalizeSocialHandle("instagram", updates.instagram);
  if (updates.tiktok !== undefined) payload.tiktok = normalizeSocialHandle("tiktok", updates.tiktok);
  if (updates.profileVisibility !== undefined) payload.profile_visibility = updates.profileVisibility;
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/** יוצר username ברירת מחדל אוטומטית בפעם הראשונה שמשתמש נכנס לעולם
 *  ה-places בלי אחד קיים - במקום לחסום אותו במסך "בחר שם משתמש" (בקשה
 *  מפורשת: "אפשר להוסיף את השאלה הזאת בבניית הפרופיל בהרשמה, לא כמסך
 *  שקופץ סתם"). כרגע פותרים בכיוון הפשוט יותר - לא שואלים בכלל, יוצרים
 *  לבד; אפשר לשנות מאוחר יותר ב-/places/settings. user_XXXXXX + ניסיון
 *  חוזר במקרה התנגשות נדיר (23505). */
export async function ensureUsername(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("username").eq("id", userId).single();
  if (existing?.username) return existing.username;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `user_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("profiles").update({ username: candidate }).eq("id", userId);
    if (!error) return candidate;
    if (error.code !== "23505") throw error;
    // התנגשות נדירה על אותו candidate - מנסים שוב עם מחרוזת אחרת.
  }
  throw new Error("לא הצלחנו ליצור שם משתמש, נסו שוב");
}
