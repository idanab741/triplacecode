import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * הערה ארכיטקטונית (סעיף 1, 52, 111 באפיון):
 * טבלת notifications הקיימת (0059) היא persistent ו-admin-only בכתיבה
 * (RLS מאפשר insert רק דרך service_role, ר' /api/admin/notifications).
 * כדי לא לשבור את זה ולא לפתוח כתיבת service_role מכל פעולת follow/like,
 * התראות social מחושבות on-the-fly באותו דפוס בדיוק כמו "Computed activity"
 * הקיים (טיול מתקרב/נשמר) - ומשתמשות באותו notification_reads הגנרי
 * (activity_key הוא טקסט חופשי, לא FK - כבר תומך בזה כמו שהוא).
 * זהו שינוי ארכיטקטוני מפורש ומתועד לפי סעיף 1, לא סתירה לאפיון.
 */

export type SocialNotificationType =
  | "NEW_FOLLOWER"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "POST_LIKE"
  | "POST_COMMENT"
  | "COMMENT_REPLY";

export interface SocialNotificationItem {
  id: string; // activity_key
  type: SocialNotificationType;
  actor: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null };
  targetId: string | null; // postId/commentId רלוונטי
  createdAt: string;
  isRead: boolean;
}

export async function getSocialNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<SocialNotificationItem[]> {
  // שלב א': המזהים של הפוסטים של המשתמש עצמו - כדי לסנן likes/comments
  // בלי להסתמך על סינטקס join מקונן לא-אמין (post.author_id) ב-PostgREST
  const { data: ownPosts } = await supabase.from("posts").select("id").eq("author_id", userId).is("deleted_at", null);
  const ownPostIds = (ownPosts ?? []).map((p) => p.id);

  const [followsRes, friendReqRes, friendAcceptedRes, likesRes, commentsRes, readsRes] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("friendships")
      .select("id, requester_id, created_at, requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url)")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("friendships")
      .select("id, addressee_id, updated_at, addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)")
      .eq("requester_id", userId)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .limit(limit),
    ownPostIds.length
      ? supabase
          .from("post_likes")
          .select("post_id, user_id, created_at, user:profiles!post_likes_user_id_fkey(id, username, full_name, avatar_url)")
          .in("post_id", ownPostIds)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as { post_id: string; user_id: string; created_at: string; user: unknown }[] }),
    ownPostIds.length
      ? supabase
          .from("comments")
          .select("id, post_id, author_id, created_at, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
          .in("post_id", ownPostIds)
          .neq("author_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as { id: string; post_id: string; author_id: string; created_at: string; author: unknown }[] }),
    supabase.from("notification_reads").select("activity_key").eq("user_id", userId),
  ]);

  const readKeys = new Set((readsRes.data ?? []).map((r) => r.activity_key));
  const items: SocialNotificationItem[] = [];

  // *** תיקון (שגיאת build - "Type ... is missing fullName, avatarUrl"):
  // התוצאה הגולמית מ-Supabase מגיעה בשמות העמודות מה-DB (snake_case:
  // full_name, avatar_url) - אבל SocialNotificationItem.actor מוגדר
  // ב-camelCase (fullName, avatarUrl). ה-cast הישן (`as unknown as {...}`)
  // רק "שיקר" ל-TypeScript עם שמות שדות snake_case, בלי למפות בפועל -
  // עכשיו כל שורה עוברת דרך הפונקציה הזו שממפה את השדות בפועל.
  function toActor(
    raw: unknown
  ): { id: string; username: string | null; fullName: string | null; avatarUrl: string | null } {
    const row = raw as { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
    return { id: row.id, username: row.username, fullName: row.full_name, avatarUrl: row.avatar_url };
  }

  for (const row of followsRes.data ?? []) {
    const key = `social_follow:${row.follower_id}:${userId}`;
    const actor = toActor(row.follower);
    items.push({ id: key, type: "NEW_FOLLOWER", actor, targetId: null, createdAt: row.created_at, isRead: readKeys.has(key) });
  }
  for (const row of friendReqRes.data ?? []) {
    const key = `social_friend_request:${row.id}`;
    const actor = toActor(row.requester);
    items.push({ id: key, type: "FRIEND_REQUEST", actor, targetId: row.id, createdAt: row.created_at, isRead: readKeys.has(key) });
  }
  for (const row of friendAcceptedRes.data ?? []) {
    const key = `social_friend_accepted:${row.id}`;
    const actor = toActor(row.addressee);
    items.push({ id: key, type: "FRIEND_ACCEPTED", actor, targetId: row.id, createdAt: row.updated_at, isRead: readKeys.has(key) });
  }
  for (const row of likesRes.data ?? []) {
    const key = `social_post_like:${row.post_id}:${row.user_id}`;
    const actor = toActor(row.user);
    items.push({ id: key, type: "POST_LIKE", actor, targetId: row.post_id, createdAt: row.created_at, isRead: readKeys.has(key) });
  }
  for (const row of commentsRes.data ?? []) {
    const key = `social_post_comment:${row.id}`;
    const actor = toActor(row.author);
    items.push({ id: key, type: "POST_COMMENT", actor, targetId: row.post_id, createdAt: row.created_at, isRead: readKeys.has(key) });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}

export async function markSocialNotificationRead(supabase: SupabaseClient, userId: string, activityKey: string) {
  const { error } = await supabase
    .from("notification_reads")
    .upsert({ user_id: userId, activity_key: activityKey }, { onConflict: "user_id,activity_key" });
  if (error) throw error;
}
