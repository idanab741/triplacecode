import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

export interface TripAddPlace {
  id: string;
  name: string;
  category: HomeQuickCategoryId;
  subcategory: string | null;
  description: string | null;
  shortDescription: string | null;
  rating: number | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  accessible: boolean | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  priceLevel: number | null;
  openingHours: string[] | null;
  /** כל התמונות שהמשתמשים העלו לפריט הזה, לפי sort_order - לא
   *  google_photo_url (בקשה מפורשת קודמת - "רק מה שהמשתמשים מעלים"). */
  photoUrls: string[];
}

/**
 * מקום בודד מ-tripadd_submissions, לעמוד /place/[id] - המקבילה של
 * getPlaceById (placesServerService.ts) אבל למקור-הדאטה החדש. משתמש
 * בלקוח הרגיל (לא admin) - תקין רק אחרי migration 0080 (שפתחה את ה-
 * SELECT policy לכל משתמש מחובר, לא רק ליוצר ה-submission).
 */
export async function getTripAddPlaceById(id: string): Promise<TripAddPlace | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select(
      "id, name, category, subcategory, description, short_description, rating, google_rating, google_rating_count, accessible, latitude, longitude, address, city, website, phone, price_level, opening_hours, tripadd_submission_media(sort_order, media_assets(url))"
    )
    .eq("id", id)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .maybeSingle();

  if (error || !data) return null;

  const media = (
    data.tripadd_submission_media as unknown as { sort_order: number; media_assets: { url: string } | null }[] | null
  )
    ?.filter((m) => m.media_assets?.url)
    .sort((a, b) => a.sort_order - b.sort_order);
  const photoUrls = (media ?? []).map((m) => m.media_assets!.url);

  return {
    id: data.id,
    name: data.name,
    category: data.category as HomeQuickCategoryId,
    subcategory: data.subcategory,
    description: data.description,
    shortDescription: data.short_description,
    rating: data.rating,
    googleRating: data.google_rating,
    googleRatingCount: data.google_rating_count,
    accessible: data.accessible,
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    address: data.address,
    city: data.city,
    website: data.website,
    phone: data.phone,
    priceLevel: data.price_level,
    openingHours: data.opening_hours,
    photoUrls,
  };
}

/**
 * "כמה שמרו את האטרקציה" - ספירה קהילתית בלבד (לא מי, ר' אותה הערת
 * פרטיות ב-placeCommunityStatsService.ts). *** בכוונה לא כולל
 * likedCount/dislikedCount בסגנון PlaceCommunityStatsSection הישן -
 * בקשה מפורשת: "לא של tripmatch, רק כמה שמרו" (אין swiping/TripMatch
 * על מקומות TripAdd בכלל, אז "אהבו/לא אהבו" לא רלוונטיים כאן).
 * admin client (service_role) - חובה כדי לספור favorites של *כל*
 * המשתמשים, לא רק את אלה של מי שמבקש (RLS על favorites נשאר
 * user-scoped, ר' migration 0006 - זה לא השתנה, ובצדק: אף אחד לא
 * צריך לראות אילו שורות favorites קיימות למשתמשים אחרים, רק את
 * הסכום).
 */
export async function getTripAddSavedCount(placeId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("favorites")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .eq("place_type", "tripadd")
    .eq("status", "saved");

  if (error) return 0;
  return count ?? 0;
}
