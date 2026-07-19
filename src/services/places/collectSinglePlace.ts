import { searchCityPlace, extractCityAndCountry } from "./googlePlacesService";
import { cleanGooglePlace, MIN_RATING } from "./placesCleaningService";
import { normalizeGoogleCategory } from "./categoryMapping";
import { createAdminClient } from "@/services/supabase/admin";

export interface CollectSinglePlaceResult {
  name: string;
  category: string;
  city: string | null;
  imageUrls: string[];
}

/**
 * אוסף מקום בודד מ-Google Places לפי שם בלבד (לא עיר+קטגוריה כמו collectPlacesForCityAndCategory).
 * משתמש באותה תשתית ניקוי (cleanGooglePlace) כדי לשמור על אותם כללי איכות.
 */
export async function collectSinglePlaceByName(name: string): Promise<CollectSinglePlaceResult> {
  const raw = await searchCityPlace(name);
  if (!raw) {
    throw new Error(`לא נמצאה תוצאה ב-Google עבור: ${name}`);
  }

  const photos = raw.photos ?? [];
  if (photos.length === 0) {
    throw new Error(`נמצא מקום ב-Google, אך אין לו תמונות - לא ניתן לשמור בלי תמונה`);
  }

  if (raw.rating !== undefined && raw.rating < MIN_RATING) {
    throw new Error(`הדירוג בגוגל (${raw.rating}) נמוך מסף האיכות שהוגדר (${MIN_RATING})`);
  }

  const category = normalizeGoogleCategory(raw.types) ?? "attractions_activities";
  const { city, country } = extractCityAndCountry(raw);

  if (!city) {
    throw new Error("לא הצלחנו לזהות עיר עבור המקום הזה מתוך גוגל - יש להוסיף ידנית");
  }

const row = await cleanGooglePlace(raw, category, city, country ?? "");
  if (!row) {
    throw new Error("המקום נפסל בבדיקת האיכות (סיבה לא ידועה)");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("places")
    .upsert({ ...row, trip_type_tags: [category] }, { onConflict: "google_place_id" });

  if (error) {
    throw new Error(`שמירה נכשלה: ${error.message}`);
  }

  return {
    name: row.name,
    category: row.category,
    city: row.city,
    imageUrls: row.image_urls,
  };
}