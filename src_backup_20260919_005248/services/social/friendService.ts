import type { SupabaseClient } from "@supabase/supabase-js";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

/** שולח בקשת חברות. אם כבר קיימת שורה (בכל כיוון) - זורק שגיאה ברורה
 *  (ה-DB חוסם כפילות דרך unique index על הצמד המנורמל). */
export async function sendFriendRequest(
  supabase: SupabaseClient,
  requesterId: string,
  addresseeId: string
): Promise<void> {
  if (requesterId === addresseeId) {
    throw new Error("אי אפשר לשלוח בקשת חברות לעצמך");
  }
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "pending" });
  if (error) {
    if (error.code === "23505") throw new Error("כבר קיימת בקשת חברות או חברות פעילה");
    throw error;
  }
}

export async function respondToFriendRequest(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string,
  response: "accepted" | "declined"
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: response })
    .eq("id", friendshipId)
    .eq("addressee_id", userId) // רק מי שקיבל את הבקשה יכול להגיב לה
    .eq("status", "pending");
  if (error) throw error;
}

export async function cancelFriendRequest(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .eq("requester_id", userId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function removeFriend(
  supabase: SupabaseClient,
  friendshipId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;
}

/** מחזיר את מצב החברות בין שני משתמשים, מנקודת המבט של viewerId */
export async function getFriendshipStatus(
  supabase: SupabaseClient,
  viewerId: string,
  otherUserId: string
): Promise<{ id: string; status: FriendshipStatus; isRequester: boolean } | null> {
  const { data } = await supabase
    .from("friendships")
    .select("id, status, requester_id")
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${viewerId})`
    )
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, status: data.status as FriendshipStatus, isRequester: data.requester_id === viewerId };
}

export async function getFriendsCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  return count ?? 0;
}

/** רשימת בקשות חברות ממתינות שהתקבלו על ידי המשתמש */
export async function getPendingFriendRequests(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, created_at, requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url)")
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFriends(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)"
    )
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    friendshipId: row.id,
    friend: row.requester_id === userId ? row.addressee : row.requester,
  }));
}
