import type { SupabaseClient } from "@supabase/supabase-js";

/** חוסם משתמש. חסימה גם מבטלת follow/friendship קיימים בשני הכיוונים,
 *  כפי שנדרש בסעיף 56 (חסימה מוחלטת). */
export async function blockUser(supabase: SupabaseClient, blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new Error("אי אפשר לחסום את עצמך");

  const { error } = await supabase.from("blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id" }
  );
  if (error) throw error;

  await Promise.all([
    supabase.from("follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId),
    supabase.from("follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId),
    supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${blockerId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${blockerId})`
      ),
  ]);
}

export async function unblockUser(supabase: SupabaseClient, blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function isBlocked(supabase: SupabaseClient, blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}

/** בודק חסימה בכל כיוון בין שני משתמשים - עוטף את פונקציית ה-DB is_blocked_between */
export async function isBlockedEitherWay(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_blocked_between", { user_a: userA, user_b: userB });
  if (error) throw error;
  return !!data;
}

export async function getBlockedUsers(supabase: SupabaseClient, blockerId: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(id, username, full_name, avatar_url)")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
