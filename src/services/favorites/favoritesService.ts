import { createClient } from "@/services/supabase/client";
import { getUnifiedPlace, type UnifiedPlace } from "@/services/places/unifiedPlaceService";

export type FavoriteStatus = "liked" | "saved" | "skipped";
export type PlaceType = "place" | "destination";

export async function getFavoriteStatus(
  userId: string,
  placeId: string
): Promise<FavoriteStatus | null> {
  const supabase = createClient();
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
  userId: string,
  placeId: string,
  placeType: PlaceType,
  action: "liked" | "saved"
): Promise<FavoriteStatus | null> {
  const supabase = createClient();
  const current = await getFavoriteStatus(userId, placeId);

  if (current === action) {
    await supabase.from("favorites").delete().eq("user_id", userId).eq("place_id", placeId);
    return null;
  }

  await supabase
    .from("favorites")
    .upsert(
      { user_id: userId, place_id: placeId, place_type: placeType, status: action },
      { onConflict: "user_id,place_id" }
    );
  return action;
}

export async function skipPlace(userId: string, placeId: string, placeType: PlaceType) {
  const supabase = createClient();
  await supabase
    .from("favorites")
    .upsert(
      { user_id: userId, place_id: placeId, place_type: placeType, status: "skipped" },
      { onConflict: "user_id,place_id" }
    );
}

/** יעדי המועדפים של המשתמש לפי סטטוס, עם פרטי התצוגה המלאים. */
export async function getFavoritePlaces(
  userId: string,
  status: FavoriteStatus
): Promise<UnifiedPlace[]> {
  const supabase = createClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("place_id")
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (!favorites || favorites.length === 0) return [];

  const results = await Promise.all(
    favorites.map((favorite) => getUnifiedPlace(favorite.place_id))
  );

  return results.filter((place): place is UnifiedPlace => place !== null);
}
