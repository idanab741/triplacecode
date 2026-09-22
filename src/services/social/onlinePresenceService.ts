import type { SupabaseClient } from "@supabase/supabase-js";

export type OnlineStatus = "online" | "recently_active" | "offline";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 דקות
const RECENT_THRESHOLD_MS = 30 * 60 * 1000; // 30 דקות

export function computeOnlineStatus(lastSeen: string | null): OnlineStatus {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff <= ONLINE_THRESHOLD_MS) return "online";
  if (diff <= RECENT_THRESHOLD_MS) return "recently_active";
  return "offline";
}

/** מעדכן last_seen למשתמש הנוכחי. נקרא מ-heartbeat קליינטי (למשל כל דקה
 *  כשהאפליקציה פעילה). גרסה בסיסית לשלב 1 - Presence אמיתי (Realtime
 *  channels, typing) מגיע בשלב 2 (סעיף 45). */
export async function heartbeat(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
}

export interface OnlineFriendDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  status: OnlineStatus;
}

/** "מחוברים עכשיו" - כל מי שיש עמו עקיבה הדדית (Mutual Follow): גם אני עוקב
 *  אחריו וגם הוא עוקב אחריי (טבלת follows, לא friendships). מוחזרים *כולם*,
 *  מחוברים ולא-מחוברים כאחד - הצבע (ירוק/צהוב) ב-UI הוא מה שמבדיל ביניהם. */
export async function getOnlineFriends(supabase: SupabaseClient, userId: string): Promise<OnlineFriendDto[]> {
  const [{ data: following, error: followingError }, { data: followers, error: followersError }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", userId),
    supabase.from("follows").select("follower_id").eq("following_id", userId),
  ]);
  if (followingError) throw followingError;
  if (followersError) throw followersError;

  const followingIds = new Set((following ?? []).map((row) => row.following_id as string));
  const mutualIds = (followers ?? [])
    .map((row) => row.follower_id as string)
    .filter((id) => followingIds.has(id));

  if (mutualIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, last_seen")
    .in("id", mutualIds);
  if (profilesError) throw profilesError;

  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    status: computeOnlineStatus(profile.last_seen),
  }));
}
