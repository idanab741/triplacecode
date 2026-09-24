import type { SupabaseClient } from "@supabase/supabase-js";
import { getFriendIds } from "./friendIds";

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

/**
 * *** "מי מחובר" בעמוד הצ'אטים (בקשה מפורשת - "מי מחובר ומי לא מכל החברים שלך"):
 * קודם רק עקיבה הדדית - ואין אף זוג כזה באפליקציה, אז הפס לא הופיע בכלל. עכשיו: כל החברים לפי
 * ההגדרה האחידה (מי שאני עוקב אחריו + חברויות מאושרות, ר' friendIds.ts) וגם כל מי שיש איתו שיחה.
 * כולם מוחזרים - מחוברים ראשונים, אחר כך לפי מי שהיה פעיל לאחרונה. הצבע ב-UI מבדיל ביניהם.
 */
export async function getOnlineFriends(supabase: SupabaseClient, userId: string): Promise<OnlineFriendDto[]> {
  const [friendIds, { data: conversations }] = await Promise.all([
    getFriendIds(supabase, userId),
    supabase.from("dm_conversations").select("user_a_id, user_b_id").or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
  ]);
  const ids = new Set(friendIds);
  for (const c of conversations ?? []) ids.add((c.user_a_id === userId ? c.user_b_id : c.user_a_id) as string);
  ids.delete(userId);
  if (ids.size === 0) return [];

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, last_seen")
    .in("id", [...ids].slice(0, 150));
  if (error) throw error;

  const rank: Record<OnlineStatus, number> = { online: 0, recently_active: 1, offline: 2 };
  return (profiles ?? [])
    .map((profile) => ({
      id: profile.id as string,
      username: profile.username as string | null,
      fullName: profile.full_name as string | null,
      avatarUrl: profile.avatar_url as string | null,
      status: computeOnlineStatus(profile.last_seen as string | null),
      lastSeen: (profile.last_seen as string | null) ?? null,
    }))
    .sort((a, b) => rank[a.status] - rank[b.status] || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""))
    .map((f) => ({ id: f.id, username: f.username, fullName: f.fullName, avatarUrl: f.avatarUrl, status: f.status }));
}
