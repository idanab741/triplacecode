import type { CandidatePlace } from "./types";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * הופך המלצת AI (עם ID זמני "ai-...") למקום אמיתי בטבלת places, ומחזיר
 * את המועמד עם ה-ID האמיתי מה-DB. נדרש כי finalizeItinerary עושה JOIN
 * דרך place_id לטבלת places - בלי שורה אמיתית שם, התחנה "נעלמת" בשקט.
 * משתמש ב-Admin client (service_role, עוקף RLS) כי משתמש רגיל לא יכול
 * לכתוב ישירות לטבלת places.
 * אם candidate.id כבר אמיתי (לא מתחיל ב-"ai-") - מוחזר כמו שהוא, בלי הכנסה.
 *
 * לפני הכנסה - בודק אם כבר קיים מקום כמעט-זהה (שם+עיר) ב-DB, ומשתמש בו
 * במקום ליצור שורה כפולה. זה מונע גם "כפילויות" במסלול (אותו מקום עם שני
 * מזהים שונים) וגם חוסך קריאות Google (geocoding/photo) חוזרות למקומות
 * פופולריים שכבר תויגו בעבר על-ידי משתמשים/טיולים אחרים.
 */
export async function ensurePlaceExists(
  candidate: CandidatePlace,
  city: string
): Promise<CandidatePlace> {
  if (!candidate.id.startsWith("ai-")) return candidate;

  const supabase = createAdminClient();

  const existing = await findExistingPlace(supabase, candidate.name, city);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("places")
    .insert({
      name: candidate.name,
      city,
      category: candidate.category,
      subcategory: candidate.subcategory,
      short_description: candidate.shortDescription,
      image_urls: candidate.imageUrls,
      rating: candidate.rating,
      rating_count: candidate.ratingCount,
      price_level: candidate.priceLevel,
      estimated_visit_minutes: candidate.estimatedVisitMinutes,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      trip_type_tags: candidate.tripTypeTags,
      cuisine_tags: candidate.cuisineTags,
      kosher: candidate.kosher,
      accessible: candidate.accessible,
      suitable_child_ages: candidate.suitableChildAges,
      budget_tier: candidate.budgetTier,
      is_area_experience: candidate.isAreaExperience,
    })
    .select("id")
    .single();

  if (error || !data) {
    // ההכנסה נכשלה - מחזירים את המועמד המקורי; finalizeItinerary יסנן
    // אותו החוצה, אבל לפחות לא נזרוק שגיאה שתעצור את כל הבנייה
    return candidate;
  }

  return { ...candidate, id: data.id as string };
}

/**
 * מחפש מקום קיים ב-DB לפי שם (ללא רגישות לרישיות/רווחים) + עיר, לפני
 * שיוצרים שורה חדשה. משתמש ב-ilike על שם מנורמל - "מגדל אייפל" ו"מגדל
 * אייפל " (עם רווח) ייחשבו אותו מקום. לא בודק מרחק כאן - אם השם+העיר
 * תואמים, זה מספיק כדי לסמוך על הרשומה הקיימת (כולל הקואורדינטות שלה,
 * שכבר עברו אימות בעבר).
 */
export async function findExistingPlace(
  supabase: ReturnType<typeof createAdminClient>,
  name: string,
  city: string
): Promise<CandidatePlace | null> {
  const normalizedName = name.trim();
  if (!normalizedName) return null;

  const { data } = await supabase
    .from("places")
    .select(
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience"
    )
    .ilike("name", normalizedName)
    .ilike("city", `%${city}%`)
    .limit(1)
    .maybeSingle();

  if (!data || data.latitude == null || data.longitude == null) return null;

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    subcategory: data.subcategory,
    shortDescription: data.short_description,
    imageUrls: data.image_urls ?? [],
    rating: data.rating,
    ratingCount: data.rating_count,
    priceLevel: data.price_level,
    estimatedVisitMinutes: data.estimated_visit_minutes,
    latitude: data.latitude,
    longitude: data.longitude,
    distanceKm: 0,
    etaMinutes: 0,
    tripTypeTags: data.trip_type_tags ?? [],
    cuisineTags: data.cuisine_tags ?? [],
    kosher: data.kosher,
    accessible: data.accessible,
    suitableChildAges: data.suitable_child_ages ?? [],
    budgetTier: data.budget_tier,
    isAreaExperience: data.is_area_experience ?? false,
  } satisfies CandidatePlace;
}
