import { searchGooglePlaces } from "./googlePlacesService";
import { cleanGooglePlace } from "./placesCleaningService";
import { CATEGORY_SEARCH_QUERIES } from "./categoryMapping";
import { createAdminClient } from "@/services/supabase/admin";

export interface CollectPlacesResult {
  fetched: number;
  saved: number;
  skipped: number;
}

/** מושך, מנקה ושומר יעדים מ-Google Places עבור עיר וקטגוריה נתונים. */
export async function collectPlacesForCityAndCategory(
  city: string,
  category: string,
  country = "ישראל"
): Promise<CollectPlacesResult> {
  const query = CATEGORY_SEARCH_QUERIES[category];
  if (!query) {
    throw new Error(`קטגוריה לא מוכרת: ${category}`);
  }

  const rawPlaces = await searchGooglePlaces({ city, query });

  // ברצף ולא Promise.all - מונע פגיעה במגבלת קצב הבקשות של גוגל
  const cleanRows: NonNullable<Awaited<ReturnType<typeof cleanGooglePlace>>>[] = [];
  for (const raw of rawPlaces) {
    const row = await cleanGooglePlace(raw, category, city, country);
    if (row) cleanRows.push(row);
  }

  if (cleanRows.length === 0) {
    return { fetched: rawPlaces.length, saved: 0, skipped: rawPlaces.length };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("places")
    .upsert(cleanRows, { onConflict: "google_place_id" });

  if (error) {
    throw new Error(`שמירה ל-Supabase נכשלה: ${error.message}`);
  }

  return {
    fetched: rawPlaces.length,
    saved: cleanRows.length,
    skipped: rawPlaces.length - cleanRows.length,
  };
}
