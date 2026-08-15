import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/services/supabase/client";
import { getUnifiedPlace, type UnifiedPlace } from "@/services/places/unifiedPlaceService";
import { recomputeTravelDna } from "@/services/travelDna/travelDnaService";

export type FavoriteStatus = "liked" | "saved" | "skipped";
export type PlaceType = "place" | "destination";
/** מקור הפעולה - איזה פיצ'ר יצר את הלייק/שמירה הזו. אותה טבלת favorites
 *  משותפת לכל האפליקציה (TripMatch, בניית מסלולים וכו') - המקור מאפשר
 *  למסכים ספציפיים (כמו "לייקים" בעמוד "כל הטיולים") להציג רק מה שנוצר
 *  אצלם, במקום את כל הלייקים בכל האפליקציה. undefined/null = לא מתויג
 *  (נתונים ישנים, מלפני הוספת השדה). */
export type FavoriteSource = "tripmatch" | "trip_builder";

export async function getFavoriteStatus(
  supabase: SupabaseClient,
  userId: string,
  placeId: string
): Promise<FavoriteStatus | null> {
  const { data } = await supabase
    .from("favorites")
    .select("status")
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .maybeSingle();
  return (data?.status as FavoriteStatus | undefined) ?? null;
}

/** מפעיל/מבטל לייק או שמירה. לחיצה על אותה פעולה שכבר פעילה מבטלת אותה. */
export async function toggleFavorite(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  placeType: PlaceType,
  action: "liked" | "saved",
  source?: FavoriteSource
): Promise<FavoriteStatus | null> {
  const current = await getFavoriteStatus(supabase, userId, placeId);

  if (current === action) {
    await supabase.from("favorites").delete().eq("user_id", userId).eq("place_id", placeId);
    if (placeType === "place") await recomputeTravelDna(supabase, userId);
    return null;
  }

  await supabase
    .from("favorites")
    .upsert(
      { user_id: userId, place_id: placeId, place_type: placeType, status: action, ...(source ? { source } : {}) },
      { onConflict: "user_id,place_id" }
    );
  if (placeType === "place") await recomputeTravelDna(supabase, userId);
  return action;
}

export async function skipPlace(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  placeType: PlaceType,
  source?: FavoriteSource
) {
  await supabase
    .from("favorites")
    .upsert(
      { user_id: userId, place_id: placeId, place_type: placeType, status: "skipped", ...(source ? { source } : {}) },
      { onConflict: "user_id,place_id" }
    );
  if (placeType === "place") await recomputeTravelDna(supabase, userId);
}

/** יעדי המועדפים של המשתמש לפי סטטוס, עם פרטי התצוגה המלאים.
 *  source אופציונלי - מסנן להצגת לייקים שמקורם בפיצ'ר ספציפי בלבד
 *  (למשל "לייקים" בעמוד "כל הטיולים" מציג רק source="tripmatch",
 *  כדי לא לערבב לייקים שנעשו תוך כדי בניית מסלול). */
export async function getFavoritePlaces(
  userId: string,
  status: FavoriteStatus,
  source?: FavoriteSource
): Promise<UnifiedPlace[]> {
  const supabase = createClient();
  let query = supabase.from("favorites").select("place_id").eq("user_id", userId).eq("status", status);
  if (source) query = query.eq("source", source);
  const { data: favorites } = await query.order("created_at", { ascending: false });

  if (!favorites || favorites.length === 0) return [];

  const results = await Promise.all(
    favorites.map((favorite) => getUnifiedPlace(favorite.place_id))
  );

  return results.filter((place): place is UnifiedPlace => place !== null);
}
