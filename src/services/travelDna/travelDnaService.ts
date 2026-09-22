import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxonomySelections } from "@/locales/he/preferencesTaxonomy";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

export interface TravelDna {
  id: string;
  user_id: string;
  culinary_styles: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility: boolean;
  accessibility_types: string[];
  transportation: string[];
  interests: string[];
  accommodation_types: string[];
  vacation_preferences: string[];
  preferred_categories: string[];
  disliked_categories: string[];
  /**
   * *** תוספת (חיבור עמוד ההעדפות החדש - 2026): שלושה שדות שנגזרים
   * מ-user_preferences.taxonomy_selections בזמן החישוב (ר' למטה):
   * - taxonomy_selections: העתק גולמי (קבוצות+תגיות לכל קטגוריה).
   * - taxonomy_categories: אילו מ-6 הקטגוריות (food/attraction/nature/
   *   shopping/sleep/nightlife) יש בהן לפחות בחירה אחת - אותו מרחב
   *   ערכים בדיוק כמו places.category, אז אפשר להצטלב איתו ישירות
   *   (למשל ב-computeFallbackScore ב-matchingService.ts).
   * - taxonomy_tags: רשימה שטוחה של כל הקבוצות+התגיות שנבחרו, לשימוש
   *   בפרומפט ה-AI (תיאור טעם עשיר בהרבה מ-interests/culinary_styles
   *   הישנים).
   */
  taxonomy_selections: TaxonomySelections | null;
  taxonomy_categories: TripAddCategory[];
  taxonomy_tags: string[];
  updated_at: string;
  created_at: string;
}

/** food/attraction/nature/shopping/sleep/nightlife - כדי לא לייבא את כל PREFERENCES_TAXONOMY רק בשביל המפתחות. */
const TAXONOMY_CATEGORY_IDS: TripAddCategory[] = ["food", "attraction", "nature", "shopping", "sleep", "nightlife"];

/** גוזר מתוך taxonomy_selections הגולמי את שתי הרשימות השטוחות שנשמרות בהמשך על travel_dna. */
function deriveTaxonomySignals(selections: TaxonomySelections | null | undefined): {
  categories: TripAddCategory[];
  tags: string[];
} {
  if (!selections) return { categories: [], tags: [] };

  const categories: TripAddCategory[] = [];
  const tags: string[] = [];

  for (const categoryId of TAXONOMY_CATEGORY_IDS) {
    const selection = selections[categoryId];
    if (!selection) continue;
    if (selection.groups.length > 0 || selection.tags.length > 0) categories.push(categoryId);
    tags.push(...selection.groups, ...selection.tags);
  }

  return { categories, tags: Array.from(new Set(tags)) };
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

  const { categories: taxonomyCategories, tags: taxonomyTags } = deriveTaxonomySignals(
    preferences?.taxonomy_selections as TaxonomySelections | null | undefined
  );

  const row = {
    user_id: userId,
    culinary_styles: preferences?.culinary_styles ?? [],
    dietary_restrictions: preferences?.dietary_restrictions ?? [],
    kosher: preferences?.kosher ?? false,
    accessibility: preferences?.accessibility ?? false,
    accessibility_types: preferences?.accessibility_types ?? [],
    transportation: preferences?.transportation ?? [],
    interests: preferences?.interests ?? [],
    accommodation_types: preferences?.accommodation_types ?? [],
    vacation_preferences: preferences?.vacation_preferences ?? [],
    preferred_categories: preferredCategories,
    disliked_categories: dislikedCategories,
    taxonomy_selections: preferences?.taxonomy_selections ?? null,
    taxonomy_categories: taxonomyCategories,
    taxonomy_tags: taxonomyTags,
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
