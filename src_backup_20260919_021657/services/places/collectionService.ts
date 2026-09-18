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
  country = "ישראל",
  subTagQuery?: string,
  subTagId?: string
): Promise<CollectPlacesResult> {
  // אם נבחרה תת-קטגוריה ספציפית - מחפשים בגוגל אותה ממש, במקום הקבוצה הכללית
  const query = subTagQuery || CATEGORY_SEARCH_QUERIES[category];
  if (!query) {
    throw new Error(`קטגוריה לא מוכרת: ${category}`);
  }

  const rawPlaces = await searchGooglePlaces({ city, query });

  // ברצף ולא Promise.all - מונע פגיעה במגבלת קצב הבקשות של גוגל
  const cleanRows: NonNullable<Awaited<ReturnType<typeof cleanGooglePlace>>>[] = [];
  for (const raw of rawPlaces) {
    const row = await cleanGooglePlace(raw, category, city, country);
    if (row && subTagId) {
      row.trip_type_tags = Array.from(new Set([...row.trip_type_tags, subTagId]));
    }
    if (row) cleanRows.push(row);
  }

 if (cleanRows.length === 0) {
    return { fetched: rawPlaces.length, saved: 0, skipped: rawPlaces.length };
  }

  const supabase = createAdminClient();

  // בודקים אילו מהמקומות האלה כבר נערכו ידנית - לא נוגעים בהם בכלל
  const placeIds = cleanRows.map((r) => r.google_place_id);
  const { data: existing } = await supabase
    .from("places")
    .select("google_place_id")
    .in("google_place_id", placeIds)
    .eq("is_manually_edited", true);

  const protectedIds = new Set((existing ?? []).map((r) => r.google_place_id));
  const rowsToSave = cleanRows.filter((r) => !protectedIds.has(r.google_place_id));
  const protectedCount = cleanRows.length - rowsToSave.length;

  if (rowsToSave.length > 0) {
    const { error } = await supabase
      .from("places")
      .upsert(rowsToSave, { onConflict: "google_place_id" });

    if (error) {
      throw new Error(`שמירה ל-Supabase נכשלה: ${error.message}`);
    }
  }

  return {
    fetched: rawPlaces.length,
    saved: rowsToSave.length,
    skipped: rawPlaces.length - cleanRows.length + protectedCount,
  };
}
