import type { SupabaseClient } from "@supabase/supabase-js";

export interface TravelDna {
  id: string;
  user_id: string;
  culinary_styles: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility: boolean;
  transportation: string[];
  interests: string[];
  accommodation_types: string[];
  vacation_preferences: string[];
  preferred_categories: string[];
  disliked_categories: string[];
  updated_at: string;
  created_at: string;
}

/**
 * מרכיב מחדש את ה-Travel DNA של המשתמש מתוך user_preferences (שכבה 1
 * במסמך האפיון) ומתוך favorites בפועל (פרק "למידה מתמשכת" - אילו
 * קטגוריות המשתמש בחר/דחה שוב ושוב). עובד עם כל לקוח Supabase
 * (דפדפן או שרת) שיש לו הרשאה לשורת המשתמש.
 */
export async function recomputeTravelDna(
  supabase: SupabaseClient,
  userId: string
): Promise<TravelDna | null> {
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const { data: favorites } = await supabase
    .from("favorites")
    .select("place_id, place_type, status")
    .eq("user_id", userId)
    .eq("place_type", "place");

  const likedOrSavedIds = (favorites ?? [])
    .filter((f) => f.status === "liked" || f.status === "saved")
    .map((f) => f.place_id);
  const skippedIds = (favorites ?? []).filter((f) => f.status === "skipped").map((f) => f.place_id);

  const preferredCategories = await getCategoriesForPlaceIds(supabase, likedOrSavedIds);
  const disliked = await getCategoriesForPlaceIds(supabase, skippedIds);
  // קטגוריה שגם אהובה וגם נדחתה לא נחשבת "נדחית" חד-משמעית
  const dislikedCategories = disliked.filter((c) => !preferredCategories.includes(c));

  const row = {
    user_id: userId,
    culinary_styles: preferences?.culinary_styles ?? [],
    dietary_restrictions: preferences?.dietary_restrictions ?? [],
    kosher: preferences?.kosher ?? false,
    accessibility: preferences?.accessibility ?? false,
    transportation: preferences?.transportation ?? [],
    interests: preferences?.interests ?? [],
    accommodation_types: preferences?.accommodation_types ?? [],
    vacation_preferences: preferences?.vacation_preferences ?? [],
    preferred_categories: preferredCategories,
    disliked_categories: dislikedCategories,
  };

  const { data, error } = await supabase
    .from("travel_dna")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return null;
  return data;
}

async function getCategoriesForPlaceIds(
  supabase: SupabaseClient,
  placeIds: string[]
): Promise<string[]> {
  if (placeIds.length === 0) return [];
  const { data } = await supabase.from("places").select("category").in("id", placeIds);
  const categories = (data ?? []).map((row) => row.category as string);
  return Array.from(new Set(categories));
}

export async function getTravelDna(
  supabase: SupabaseClient,
  userId: string
): Promise<TravelDna | null> {
  const { data } = await supabase.from("travel_dna").select("*").eq("user_id", userId).maybeSingle();
  return data;
}
