import type { SupabaseClient } from "@supabase/supabase-js";

/** חיפוש אנשים/יוצרים לפי username/שם מלא. חיפוש Places/Trips/Communities
 *  ממשיך להשתמש במנועים הקיימים (unifiedPlaceService וכו') - אינטגרציה
 *  ברמת ה-UI, לא כפילות כאן (סעיף 21). Trips/Communities יתווספו כשאלו
 *  קיימים (שלבים 2-3). */
export async function searchPeople(supabase: SupabaseClient, query: string, limit = 15) {
  const term = query.trim();
  if (!term) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_creator")
    .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function searchCreators(supabase: SupabaseClient, query: string, limit = 15) {
  const term = query.trim();
  if (!term) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_creator")
    .eq("is_creator", true)
    .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
