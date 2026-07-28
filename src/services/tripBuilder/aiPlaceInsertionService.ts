import type { CandidatePlace } from "./types";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * הופך המלצת AI (עם ID זמני "ai-...") למקום אמיתי בטבלת places, ומחזיר
 * את המועמד עם ה-ID האמיתי מה-DB. נדרש כי finalizeItinerary עושה JOIN
 * דרך place_id לטבלת places - בלי שורה אמיתית שם, התחנה "נעלמת" בשקט.
 * משתמש ב-Admin client (service_role, עוקף RLS) כי משתמש רגיל לא יכול
 * לכתוב ישירות לטבלת places.
 * אם candidate.id כבר אמיתי (לא מתחיל ב-"ai-") - מוחזר כמו שהוא, בלי הכנסה.
 */
export async function ensurePlaceExists(
  candidate: CandidatePlace,
  city: string
): Promise<CandidatePlace> {
  if (!candidate.id.startsWith("ai-")) return candidate;

  const supabase = createAdminClient();

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
