import type { SupabaseClient } from "@supabase/supabase-js";

export interface SuggestedTravelerDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  viewerFollowing: boolean;
}

/** "מטיילים מומלצים עבורך" - כרגע מוצג **רק** טריפי (בקשה מפורשת:
 *  "לא צריך את המטיילים המומלצים הפיקטיביים - רק עיגול של טריפי").
 *  אם עוד לא נוצר חשבון טריפי ב-DB (migration 0075 לא רץ), מחזירים
 *  רשימה ריקה - הסקשן פשוט לא מוצג, בלי ליפול בחזרה למשתמשים אקראיים. */
export async function getSuggestedTravelers(supabase: SupabaseClient, viewerId: string): Promise<SuggestedTravelerDto[]> {
  const { data: trippy } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_creator")
    .eq("username", "trippy")
    .maybeSingle();

  if (!trippy || trippy.id === viewerId) return [];

  const { data: alreadyFollowing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .eq("following_id", trippy.id)
    .maybeSingle();

  return [
    {
      id: trippy.id,
      username: trippy.username,
      fullName: trippy.full_name,
      avatarUrl: trippy.avatar_url,
      isCreator: trippy.is_creator,
      viewerFollowing: !!alreadyFollowing,
    },
  ];
}
