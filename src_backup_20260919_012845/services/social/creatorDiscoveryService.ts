import type { SupabaseClient } from "@supabase/supabase-js";
import { getFollowCounts } from "./followService";

export interface CreatorCardDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  followersCount: number;
  category: string[];
  tripsCount: number;
  viewerFollowing: boolean;
}

/** "יוצרים שכדאי לעקוב אחריהם" - גרסה בסיסית לשלב 1: creators שהמשתמש
 *  עדיין לא עוקב אחריהם, ממוינים לפי מספר עוקבים. דירוג לפי Travel DNA /
 *  Preferences / Destinations מתווסף בשלב 3 (Creator Discovery, סעיף 23) -
 *  לא ממציאים כאן מספר "התאמה" שאין לו בסיס נתונים (סעיף 18,39). */
export async function getSuggestedCreators(
  supabase: SupabaseClient,
  viewerId: string,
  limit = 10
): Promise<CreatorCardDto[]> {
  const { data: alreadyFollowing } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
  const excludeIds = new Set([...(alreadyFollowing ?? []).map((f) => f.following_id), viewerId]);

  const { data: creators, error } = await supabase
    .from("creator_profiles")
    .select("user_id, category, profile:profiles!creator_profiles_user_id_fkey(id, username, full_name, avatar_url)")
    .limit(limit + excludeIds.size);
  if (error) throw error;

  const filtered = (creators ?? []).filter((c) => !excludeIds.has(c.user_id)).slice(0, limit);
  if (filtered.length === 0) return [];

  const creatorIds = filtered.map((c) => c.user_id);
  const [followCountsList, tripsCountsRes] = await Promise.all([
    Promise.all(creatorIds.map((id) => getFollowCounts(supabase, id))),
    // trips טרם קיים כטבלה בשלב 1 של המימוש (מגיע ב-0073) - בינתיים 0,
    // ייסגר עם אינטגרציית trips בהמשך
    Promise.resolve(creatorIds.map(() => 0)),
  ]);

  return filtered.map((c, i) => {
    const profile = c.profile as unknown as { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
    return {
      id: c.user_id,
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      followersCount: followCountsList[i]?.followers ?? 0,
      category: c.category ?? [],
      tripsCount: tripsCountsRes[i] ?? 0,
      viewerFollowing: false,
    };
  }).sort((a, b) => b.followersCount - a.followersCount);
}
