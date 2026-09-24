import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * *** הגדרה אחידה של "חברים" (בקשה מפורשת - "איך אתה מגדיר חברים?"):
 * באפליקציה אין כפתור "הוסף חבר" - הכפתור בפרופיל הוא "עקוב" (טבלת follows). לכן טבלת
 * friendships כמעט ריקה (0 חברויות מאושרות), ו"חברים" במפה ובפיד תמיד יצא ריק.
 *
 * מעכשיו "חברים" = כל מי שאני עוקב אחריו (follows), וגם חברויות מאושרות אם יהיו
 * (friendships, status=accepted) - כמו לשונית "Following" באינסטגרם/X.
 * מקור אמת יחיד: המפה (friendsMapService) ולשונית "חברים" בפיד (feedService) משתמשות בזה.
 */
export async function getFriendIds(supabase: SupabaseClient, viewerId: string): Promise<Set<string>> {
  const [followsRes, friendshipsRes] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", viewerId),
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
      .eq("status", "accepted"),
  ]);
  if (followsRes.error) console.error("[friendIds] follows query failed:", followsRes.error.message);
  if (friendshipsRes.error) console.error("[friendIds] friendships query failed:", friendshipsRes.error.message);

  const ids = new Set<string>();
  for (const row of followsRes.data ?? []) ids.add(row.following_id as string);
  for (const row of friendshipsRes.data ?? []) {
    ids.add((row.requester_id === viewerId ? row.addressee_id : row.requester_id) as string);
  }
  ids.delete(viewerId);
  return ids;
}
