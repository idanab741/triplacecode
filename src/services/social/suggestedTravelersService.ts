import type { SupabaseClient } from "@supabase/supabase-js";

export interface SuggestedTravelerDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  viewerFollowing: boolean;
}

/** "מטיילים מומלצים עבורך" - שורת אנשים כלליים (לא מוגבל ל-Creators,
 *  בשונה מ-creatorDiscoveryService) שהמשתמש עדיין לא עוקב אחריהם.
 *
 *  *** מצומצם זמנית לפי בקשה מפורשת: "כרגע רק את 'טריפי'" - עד שיהיה
 *  מאגר אמיתי של מטיילים מומלצים, מציגים רק את חשבון המערכת "טריפי"
 *  (username='trippy', ר' migration 0075). ברגע שתרצו להרחיב חזרה
 *  לרשימה כללית - למחוק את הבלוק המסומן למטה ולהשאיר את ה-fallback. */
export async function getSuggestedTravelers(
  supabase: SupabaseClient,
  viewerId: string,
  limit = 12
): Promise<SuggestedTravelerDto[]> {
  const { data: alreadyFollowing } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
  const excludeIds = [...(alreadyFollowing ?? []).map((f) => f.following_id), viewerId];

  // *** צמצום זמני - רק טריפי ***
  const { data: trippy } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_creator")
    .eq("username", "trippy")
    .maybeSingle();

  if (trippy) {
    if (excludeIds.includes(trippy.id)) return []; // כבר עוקב/זה אני
    return [
      {
        id: trippy.id,
        username: trippy.username,
        fullName: trippy.full_name,
        avatarUrl: trippy.avatar_url,
        isCreator: trippy.is_creator,
        viewerFollowing: false,
      },
    ];
  }
  // אם טריפי עוד לא נוצר ב-DB (migration 0075 לא רצה עדיין) - נופל
  // בחזרה לרשימה הכללית, כדי שהסקשן לא יהיה ריק סתם.

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_creator")
    .eq("profile_visibility", "public")
    .not("id", "in", `(${excludeIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    fullName: p.full_name,
    avatarUrl: p.avatar_url,
    isCreator: p.is_creator,
    viewerFollowing: false,
  }));
}
