import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidatePlace, LatLng, DistanceBand } from "./types";
import {
  distanceBandToRadiusKm,
  haversineDistanceKm,
  estimateTravelMinutes,
  kmToDegreesLat,
  kmToDegreesLng,
} from "./geo";
import { TRIP_TYPE_TAG_TO_FALLBACK_CATEGORIES } from "@/constants/placeCategories";
import { AI_TRIP_BUILDER_SOURCE } from "./aiPlaceInsertionService";

interface FetchCandidatePoolParams {
  category: string;
  origin: LatLng;
  distanceBand: DistanceBand;
  /** מגבלה קשיחה בין תחנות עוקבות (לא מהבית). כשמוגדר - עוקף את distanceBand. */
  maxDistanceKm?: number;
  maxPriceLevel: number | null;
  excludePlaceIds: string[];
  /** אילוץ מחייב: אם true, מציגים אך ורק מקומות שסומנו במפורש kosher=true.
   *  מקומות שעדיין לא תויגו (null) ומקומות שסומנו kosher=false - שניהם נפסלים.
   *  זה משתמש שסימן "כשר" רואה אך ורק מקומות מהמאגר המאומת ככשר - לא מנחשים. */
  requireKosher?: boolean;
  /** אילוץ קשיח: אם true, פוסלים רק מקומות שסומנו במפורש accessible=false. */
  requireAccessible?: boolean;
}

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  image_urls: string[];
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  estimated_visit_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
  trip_type_tags: string[] | null;
  cuisine_tags: string[] | null;
  kosher: boolean | null;
  accessible: boolean | null;
  suitable_child_ages: string[] | null;
  budget_tier: string | null;
  is_area_experience: boolean | null;
  tags: string[] | null;
}

/**
 * שולף מאגר מועמדים מטבלת places לקטגוריה נתונה.
 * הסינון מתבצע לפי רדיוס (Haversine) ותקציב.
 * אם אין תוצאות - מנסה שוב ללא מגבלת תקציב.
 */
export async function fetchCandidatePool(
  supabase: SupabaseClient,
  params: FetchCandidatePoolParams
): Promise<CandidatePlace[]> {
  const tightRadiusKm = params.maxDistanceKm ?? distanceBandToRadiusKm(params.distanceBand);

  let pool = await queryPool(supabase, params, tightRadiusKm, true);
  if (pool.length > 0) return pool;

  pool = await queryPool(supabase, params, tightRadiusKm, false);
  if (pool.length > 0) return pool;

  // אם היה רדיוס צר (בין תחנות) ועדיין אין מועמדים - מרחיבים בהדרגה
  if (params.maxDistanceKm != null) {
    const widerRadiusKm = distanceBandToRadiusKm(params.distanceBand);
    pool = await queryPool(supabase, params, widerRadiusKm, true);
    if (pool.length > 0) return pool;
    return queryPool(supabase, params, widerRadiusKm, false);
  }

  return pool;
}

async function queryPool(
  supabase: SupabaseClient,
  params: FetchCandidatePoolParams,
  radiusKm: number,
  applyBudget: boolean
): Promise<CandidatePlace[]> {
  const latDelta = kmToDegreesLat(radiusKm);
  const lngDelta = kmToDegreesLng(radiusKm, params.origin.lat);

  // הגנת רשת-ביטחון: לצד ההתאמה הראשית לפי trip_type_tags, מקבלים גם
  // מקום שתויג נכון ב"קטגוריה ראשית" (place.category, 5 הערכים שנבחרים
  // באדמין) גם אם ה-trip_type_tags שלו **ריק לגמרי** - בלי זה, מקום אמיתי
  // שנוסף ותויג רק בקטגוריה הראשית (למשל "מסעדות") נעלם בשקט מהחיפוש.
  //
  // תיקון קריטי: בעבר הגיבוי הזה חל גם על מקומות עם trip_type_tags לא-ריק
  // אבל *שונה* - למשל חוף ים שכן תויג במדויק trip_type_tags=["beaches_pools"]
  // אבל category="nature" (קטגוריה ראשית רחבה). חיפוש ל"nature_trails"
  // (מסלול טבע) היה "תופס" את החוף הזה כי category="nature" נמצא ברשימת
  // הגיבוי ל-nature_trails - למרות שה-trip_type_tags המדויק שלו כבר אומר
  // בבירור שהוא חוף, לא מסלול. זו הסיבה שחיפוש "מסלול טבע עם תצפית" החזיר
  // חופים בפועל. עכשיו הגיבוי לפי קטגוריה ראשית חל **רק** על מקומות
  // שה-trip_type_tags שלהם ריק לגמרי (לא תויגו כלל) - לא דורס תיוג מדויק
  // וקיים שכבר אומר משהו אחר. trip_type_tags נשאר מקור-האמת העיקרי.
  const fallbackCategories = TRIP_TYPE_TAG_TO_FALLBACK_CATEGORIES[params.category] ?? [];
  const categoryFilter =
    fallbackCategories.length > 0
      ? `trip_type_tags.ov.{${params.category}},and(category.in.(${fallbackCategories.join(",")}),trip_type_tags.eq.{})`
      : `trip_type_tags.ov.{${params.category}}`;

  let query = supabase
    .from("places")
    .select(
      // "tags" נוסף כאן: השדה החופשי שבו נשמרים כל התיוגים העדינים
      // שהאדמין קבע ידנית לכל מקום (PLACE_TYPE_TAGS/TRIPMATCH_TAGS/
      // DNA_TAGS, ר' constants/placeTagOptions.ts) - למשל ההבדל בין
      // "עגלת קפה" ל"בית קפה יושב", או סגנון מדויק של אטרקציה. עד עכשיו
      // השדה הזה נשמר ב-DB אבל **מעולם לא נשלף כאן ולא הועבר לדירוג**
      // (rankingService.ts) - כל התיוג העדין שהושקעה בו הלך לאיבוד
      // בפועל; הדירוג הכיר רק category/trip_type_tags הגסים.
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience,tags"
    )
    // קריטי: זה בדיוק החיפוש ש"מהמאגר שלנו" אמור להתכוון אליו - תוכן
    // שאדמין בפועל אצר/בדק (כולל מה שהוגש דרך Discovery ואומת ידנית),
    // לא כל שורה שיש לה מזהה בטבלת places. בלעדי הסינון הזה, מקום
    // שנוצר פעם אחת ע"י AI (aiPlaceInsertionService.ts, למשל כשהמאגר
    // באמת היה ריק) הופך אוטומטית ל"מהמאגר שלנו" בכל חיפוש עתידי - לולאה
    // שבה AI "מזהם" את המאגר בשקט, ומחיקה ידנית באדמין לא תמיד מספיקה
    // כי אין דרך להבדיל בעין בין תוכן אמיתי לתוכן שנוצר אוטומטית.
    // *** התגלית האמיתית: מיגרציה 0032 (re_archive_everything.sql) סימנה
    // בעבר is_legacy=true על **כל** שורה קיימת בטבלת places, בכוונה -
    // כדי שעמוד האדמין /admin/places (שכברירת מחדל מציג רק is_legacy=false,
    // ר' app/api/admin/places/route.ts) "יתחיל נקי" מהרגע ההוא. עמוד
    // האדמין באמת מתנהג ככה - אבל fetchCandidatePool כאן **מעולם לא**
    // כיבד את אותה חלוקה: הוא חיפש בין כל השורות בטבלה, כולל כל מה
    // שסומן is_legacy=true והפך בלתי-נראה לגמרי באדמין. זו הייתה הסיבה
    // האמיתית ש"המאגר שלנו" בבנייה בפועל החזיר מקומות (למשל "ראש
    // ציפור") שהאדמין לא הצליח למצוא בחיפוש בעמוד שלו בכלל - הם באמת
    // בטבלה, אבל מסומנים legacy ולכן מוסתרים שם. עכשיו שני המקומות
    // מסתכלים בדיוק על אותה הגדרה של "המאגר שלנו". ***
    .eq("is_legacy", false)
    .neq("source", AI_TRIP_BUILDER_SOURCE)
    .or(categoryFilter)
    .gte("latitude", params.origin.lat - latDelta)
    .lte("latitude", params.origin.lat + latDelta)
    .gte("longitude", params.origin.lng - lngDelta)
    .lte("longitude", params.origin.lng + lngDelta);

  if (applyBudget && params.maxPriceLevel != null) {
    query = query.or(`price_level.is.null,price_level.lte.${params.maxPriceLevel}`);
  }

  // אילוץ כשרות מחייב: אך ורק מקומות שאומתו כ-kosher=true. בניגוד לנגישות
  // (למטה) - כאן גם מקום לא-מתויג (null) נפסל, כי "כשר" הוא דרישה דתית
  // מחייבת שאסור לנחש בה; עדיף מעט תוצאות ומדויקות מהרבה תוצאות לא ודאיות.
  if (params.requireKosher) {
    query = query.eq("kosher", true);
  }
  if (params.requireAccessible) {
    query = query.or("accessible.is.null,accessible.eq.true");
  }

  if (params.excludePlaceIds.length > 0) {
    query = query.not("id", "in", `(${params.excludePlaceIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[CandidatePool Error]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      category: params.category,
    });

    return [];
  }

  const rows = (data ?? []) as PlaceRow[];

  return rows
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => {
      const distanceKm = haversineDistanceKm(params.origin, {
        lat: row.latitude!,
        lng: row.longitude!,
      });

      return {
        id: row.id,
        name: row.name,
        category: row.category,
        subcategory: row.subcategory,
        shortDescription: row.short_description,
        imageUrls: row.image_urls ?? [],
        rating: row.rating,
        ratingCount: row.rating_count,
        priceLevel: row.price_level,
        estimatedVisitMinutes: row.estimated_visit_minutes,
        latitude: row.latitude!,
        longitude: row.longitude!,
        distanceKm,
        etaMinutes: estimateTravelMinutes(distanceKm, "drive"),
        tripTypeTags: row.trip_type_tags ?? [],
        cuisineTags: row.cuisine_tags ?? [],
        kosher: row.kosher,
        accessible: row.accessible,
        suitableChildAges: row.suitable_child_ages ?? [],
        budgetTier: row.budget_tier,
        isAreaExperience: row.is_area_experience ?? false,
        tags: row.tags ?? [],
      } satisfies CandidatePlace;
    })
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort(() => Math.random() - 0.5); // ערבוב רנדומלי - לא תמיד הקרוב ביותר ראשון
}