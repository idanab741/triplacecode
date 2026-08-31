import type { SupabaseClient } from "@supabase/supabase-js";

/** עוקב אחרי משתמש. אסור לעקוב אחרי עצמך - נאכף גם ב-DB (constraint) וגם כאן. */
export async function followUser(
  supabase: SupabaseClient,
  followerId: string,
  followingId: string
): Promise<void> {
  if (followerId === followingId) {
    throw new Error("אי אפשר לעקוב אחרי עצמך");
  }
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: "follower_id,following_id" });
  if (error) throw error;
}

export async function unfollowUser(
  supabase: SupabaseClient,
  followerId: string,
  followingId: string
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function isFollowing(
  supabase: SupabaseClient,
  followerId: string,
  followingId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function getFollowCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

/** רשימת עוקבים אחרי משתמש, עם pagination (cursor לפי created_at, סעיף 85) */
export async function getFollowers(
  supabase: SupabaseClient,
  userId: string,
  limit = 30,
  before?: string
) {
  let query = supabase
    .from("follows")
    .select("follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, is_creator)")
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** רשימת מי שהמשתמש עוקב אחריו, עם pagination */
export async function getFollowing(
  supabase: SupabaseClient,
  userId: string,
  limit = 30,
  before?: string
) {
  let query = supabase
    .from("follows")
    .select("following_id, created_at, following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url, is_creator)")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
