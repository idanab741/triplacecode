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

/** רשימת "חברים אונליין" - רק מתוך Friends מאושרים, בהתאם לפרטיות
 *  (סעיף 8: "אין לחשוף מידע מעבר למה שהגדרות הפרטיות מאפשרות"). */
export async function getOnlineFriends(supabase: SupabaseClient, userId: string): Promise<OnlineFriendDto[]> {
  const { data: friendships, error } = await supabase
    .from("friendships")
    .select(
      "requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url, last_seen), addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url, last_seen)"
    )
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;

  const friends = (friendships ?? []).map((row) => {
    const isRequester = row.requester_id === userId;
    const friend = (isRequester ? row.addressee : row.requester) as unknown as {
      id: string;
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
      last_seen: string | null;
    };
    return {
      id: friend.id,
      username: friend.username,
      fullName: friend.full_name,
      avatarUrl: friend.avatar_url,
      status: computeOnlineStatus(friend.last_seen),
    };
  });

  return friends.filter((f) => f.status !== "offline");
}
