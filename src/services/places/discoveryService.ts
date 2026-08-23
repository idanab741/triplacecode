import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm, kmToDegreesLat, kmToDegreesLng } from "@/services/tripBuilder/geo";
import type { LatLng } from "@/services/tripBuilder/types";
import { AI_TRIP_BUILDER_SOURCE } from "@/services/tripBuilder/aiPlaceInsertionService";
import { getSubcategoryLabel } from "@/services/places/tripTaxonomy";

/**
 * שכבת Discovery (Audit מול "PROMPT 1 - בניית עמוד Discovery / יעדים
 * חמים"): שירות דטרמיניסטי לגמרי (בלי AI, בדיוק לפי דרישה 13/14) שמחזיר
 * מקומות רלוונטיים למיקום+קטגוריה, מדורגים לפי ציון משוקלל. **לא** בונה
 * מסלול, לא קובע ימים/שעות/pace - זו שכבת "מה יש לראות באזור", לא
 * "trip builder". ממחזר את דפוס הרדיוס הגיאוגרפי הקיים (bounding box +
 * Haversine, בדיוק כמו candidatePoolService.ts) - לא ממציא מנגנון מיקום
 * חדש.
 */

export interface DiscoveryPlace {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  /** תיקון (Audit - "למה הקטגוריות באנגלית ולא בעברית??"): תרגום עברי
   *  מוכן של subcategory, ל-UI בלבד. null אם subcategory הוא ערך לא-
   *  מוכר (למשל "general_attractions" - נתון legacy פגום, ר' placeCategories.ts) -
   *  במקרה כזה עדיף לא להציג כלום מאשר להציג את המזהה הגולמי באנגלית. */
  subcategoryLabel: string | null;
  shortDescription: string | null;
  imageUrls: string[];
  rating: number | null;
  ratingCount: number | null;
  city: string | null;
  distanceKm: number | null;
  tags: string[];
}

export interface DiscoveryLocation {
  /** קואורדינטות בפועל (מ-Geolocation) - אם קיימות, מעדיפים חיפוש רדיוס
   *  אמיתי (לא רק שם עיר טקסטואלי, שיכול לפספס מקומות "בסביבה" שלא
   *  תויגו בדיוק לאותה מחרוזת עיר). */
  lat: number | null;
  lng: number | null;
  /** שם עיר (מבחירה ידנית, או מ-reverse-geocode) - משמש כפולבאק כשאין
   *  קואורדינטות, וגם לתצוגה בכותרת העמוד. */
  city: string | null;
}

/** רדיוס חיפוש ברירת מחדל ל"טיול יומי" - יעד קרוב, לא כל הארץ (בהתאם
 *  לעיקרון LOCATION FIRST - "אל תציג מקומות אקראיים מכל הארץ"). */
const DEFAULT_DISCOVERY_RADIUS_KM = 40;
/** תקרת בטיחות - לעולם לא רדיוס-על, גם אם קריאה חיצונית תעביר ערך גדול. */
const MAX_DISCOVERY_RADIUS_KM = 120;
/** ברירת המחדל כשאין מיקום נבחר בכלל ("אטרקציות כלליות") - מדינת הבית
 *  של TRIPLACE (כבר ברירת המחדל הקיימת ב-collectionService.ts/
 *  profile-setup) - לא "מכל העולם". */
const DEFAULT_DISCOVERY_COUNTRY = "ישראל";

const PLACE_COLUMNS =
  "id,name,category,subcategory,short_description,image_urls,rating,rating_count,city,latitude,longitude,tags";

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  image_urls: string[] | null;
  rating: number | null;
  rating_count: number | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[] | null;
}

function rowToDiscoveryPlace(row: PlaceRow, origin: LatLng | null): DiscoveryPlace {
  const distanceKm =
    origin != null && row.latitude != null && row.longitude != null
      ? haversineDistanceKm(origin, { lat: row.latitude, lng: row.longitude })
      : null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    subcategoryLabel: getSubcategoryLabel(row.subcategory),
    shortDescription: row.short_description,
    imageUrls: row.image_urls ?? [],
    rating: row.rating,
    ratingCount: row.rating_count,
    city: row.city,
    distanceKm,
    tags: row.tags ?? [],
  };
}

/**
 * ציון משוקלל (Bayesian weighted rating, שיטה סטנדרטית - לא "המצאה
 * חדשה") - בדיוק פותר את הדרישה המפורשת: "דירוג של 5.0 עם 2 ביקורות
 * לא אמור לנצח 4.7 עם 500 ביקורות". MIN_VOTES/GLOBAL_AVG_RATING הם
 * קבועים סבירים (לא נלמדים/AI) - "מושכים" מקום עם מעט ביקורות לכיוון
 * הממוצע הכללי, במקום לסמוך על 1-2 ביקורות כאילו הן ודאות מלאה.
 * מחסירים "קנס מרחק" קל - מקום קרוב יותר מדורג מעט גבוה יותר מזהה
 * זהה שרחוק יותר, בלי להפוך למסנן.
 */
const MIN_VOTES_FOR_FULL_CONFIDENCE = 15;
const GLOBAL_AVG_RATING = 4.2;
const DISTANCE_PENALTY_PER_KM = 0.01;

function computeWeightedScore(place: DiscoveryPlace): number {
  const rating = place.rating ?? GLOBAL_AVG_RATING;
  const votes = place.ratingCount ?? 0;
  const weightedRating =
    (votes * rating + MIN_VOTES_FOR_FULL_CONFIDENCE * GLOBAL_AVG_RATING) / (votes + MIN_VOTES_FOR_FULL_CONFIDENCE);
  const distancePenalty = place.distanceKm != null ? place.distanceKm * DISTANCE_PENALTY_PER_KM : 0;
  return weightedRating - distancePenalty;
}

/**
 * תיקון באג אמיתי נוסף ("עגלות קפה צריכות להציג עגלות קפה! פארקים
 * צריכים להיות פארקים!"): candidatePoolService.ts (Trip Builder) משתמש
 * ב-Fallback ל-places.category (5 ערכים גסים בלבד - restaurants/
 * nightlife/attractions/nature/hotels, ר' placeCategories.ts) כשאין
 * trip_type_tags בכלל - זה סביר *שם* כי ה-Slot חייב להתמלא במשהו סביר
 * מתוך בריכה מוגבלת, וכל שאר הפייפליין (Ranking/Validation) עדיין
 * מסנן החוצה טעויות. אבל ב-Discovery, "עגלות קפה" חייב להיות **מדויק** -
 * הפעלת אותו Fallback (category="restaurants" -> גם "coffee_carts_cafes"
 * וגם "wineries_dining") היא בדיוק מה שהחזיר "Heritage Restaurant"/
 * "Restaurant Slow" (place.category="restaurants", trip_type_tags ריק)
 * לתוך סקשן עגלות הקפה. לכן כאן - **התאמה מחמירה בלבד** לפי
 * trip_type_tags.ov, בלי שום Fallback ל-category הגס. עדיף פחות
 * תוצאות ומדויקות (ואם באמת אין - Empty State כבר קיים) מאשר תוצאות
 * לא-רלוונטיות "כדי למלא קרוסלה".
 */
function buildCategoryOrFilter(categoryIds: string[]): string {
  return categoryIds.map((categoryId) => `trip_type_tags.ov.{${categoryId}}`).join(",");
}

interface FetchDiscoveryPlacesParams {
  location: DiscoveryLocation;
  /** מזהה קטגוריה/trip_type_tag (תואם ל-tripTaxonomy.ts) - חובה, אלא
   *  אם categories/rawOrFilter מועבר. ר' buildCategoryOrFilter למעלה -
   *  ההתאמה בפועל היא trip_type_tags.ov, לא עמודת category ישירות. */
  category?: string;
  /** לחיפוש רוחבי (כמו "הכי חמים עכשיו") - כמה קטגוריות ביחד. */
  categories?: string[];
  /** סינון subcategory אופציונלי (למשל wineries_dining + subcategory
   *  in ["winery","brewery"] ל"יקבים ומבשלות", לא כל wineries_dining).
   *  זה עדיין עמודת subcategory ישירות (לא trip_type_tags) - היא לא
   *  סובלת מאותו באג, כי אין לה מנגנון Fallback מקביל בשום מקום אחר
   *  במערכת. */
  subcategories?: string[];
  /** תיקון (Audit מול "חופשה בארץ" - "❤️ חופשה זוגית"/"👨‍👩‍👧‍👦 חופשה
   *  משפחתית"/"🏕️ צימרים, גלמפינג וקמפינג"): כל אחד מהתגים האלה
   *  (DNA_TAGS/PLACE_TYPE_TAGS הקיימים ב-placeTagOptions.ts, כולם
   *  נשמרים באותה עמודת places.tags) - OR ביניהם (`tags.ov`, לא
   *  `tags.cs` - מספיק תג אחד מהרשימה, לא כולם). למשל
   *  requiredAnyTags:["cabin","glamping","camping"] מחזיר מקום שתויג
   *  ב**כל אחד** מהשלושה, לא רק מקום שתויג בכל השלושה יחד. */
  requiredAnyTags?: string[];
  /** תיקון (Audit - "🏨 מלונות"): places.category עצמו (5 הערכים הגסים,
   *  ר' placeCategories.ts) - "מלונות" (category="hotels") הם המקרה
   *  היחיד ש**אינו** מנוהל דרך trip_type_tags בכלל (ר' ההערה ב-
   *  placeCategories.ts) - חובה להתאים ישירות לעמודת category, לא
   *  ל-trip_type_tags. משולב ב-OR עם requiredAnyTags אם שניהם קיימים
   *  (למשל category="hotels" OR tags overlaps ["hotel","resort"]).
   */
  categoryColumnEquals?: string;
  /**
   * תיקון (Audit - "מסעדות וקפה - קטגוריות לפי סוג מטבח"): places.cuisine_tags
   * הוא **עמודה נפרדת** מ-tags (ר' migration 0027) - לא אותו מנגנון כמו
   * requiredAnyTags למעלה, למרות שהצורה דומה (OR/overlaps). taxonomy_terms
   * עם taxonomy_group='cuisine' (migration 0018) הוא מקור-האמת הקיים לערכים
   * האלה (israeli_middle_eastern/italian/asian/... 17 ערכים) - לא נבנתה
   * טקסונומיה מקבילה, רק שימוש בעמודה שכבר קיימת.
   */
  requiredAnyCuisineTags?: string[];
  radiusKm?: number;
  limit?: number;
  excludeIds?: string[];
  /** תיקון (Audit - "🌙 חיי לילה" בחופשה בארץ): queryPlaces מדיר nightlife
   *  כברירת מחדל (ר' ההערה למטה) - true מבטל את ההדרה הזו במפורש, לשימוש
   *  רק בסקשן שבאמת מבקש nightlife (לא דולף לשום סקשן אחר, כי ההתאמה
   *  עדיין trip_type_tags.ov מדויק, לא Fallback רחב). */
  allowNightlife?: boolean;
}

/** בונה שאילתת bounding box + city fallback - אותו דפוס בדיוק כמו
 *  candidatePoolService.ts (queryPool), לא מנגנון מיקום חדש. */
async function queryPlaces(
  supabase: SupabaseClient,
  params: FetchDiscoveryPlacesParams
): Promise<PlaceRow[]> {
  const { location } = params;
  const radiusKm = Math.min(params.radiusKm ?? DEFAULT_DISCOVERY_RADIUS_KM, MAX_DISCOVERY_RADIUS_KM);

  let query = supabase
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("is_legacy", false)
    // עקביות עם candidatePoolService.ts: לא מציגים מקומות שנוצרו אוטומטית
    // ע"י AI ולא עברו אימות אדמין (source=AI_TRIP_BUILDER_SOURCE).
    .neq("source", AI_TRIP_BUILDER_SOURCE);

  // תיקון (Audit - "חיי לילה" בחופשה בארץ): הדרת nightlife היא ברירת
  // מחדל שמתאימה ל"טיול יומי" (אין שם סקשן nightlife בכלל), אבל לא
  // עקרון אוניברסלי - כשסקשן מבקש nightlife במפורש (allowNightlife),
  // לא מדירים. עדיין לא "דליפה" - ההתאמה עצמה תמיד trip_type_tags.ov
  // מדויק, לא Fallback רחב.
  if (!params.allowNightlife) {
    query = query.neq("category", "nightlife");
  }

  if (params.categoryColumnEquals && params.requiredAnyTags && params.requiredAnyTags.length > 0) {
    query = query.or(`category.eq.${params.categoryColumnEquals},tags.ov.{${params.requiredAnyTags.join(",")}}`);
  } else if (params.categoryColumnEquals) {
    query = query.eq("category", params.categoryColumnEquals);
  } else {
    if (params.category) {
      query = query.or(buildCategoryOrFilter([params.category]));
    } else if (params.categories && params.categories.length > 0) {
      query = query.or(buildCategoryOrFilter(params.categories));
    }
    if (params.requiredAnyTags && params.requiredAnyTags.length > 0) {
      query = query.overlaps("tags", params.requiredAnyTags);
    }
  }

  if (params.subcategories && params.subcategories.length > 0) {
    query = query.in("subcategory", params.subcategories);
  }

  if (params.requiredAnyCuisineTags && params.requiredAnyCuisineTags.length > 0) {
    query = query.overlaps("cuisine_tags", params.requiredAnyCuisineTags);
  }

  if (params.excludeIds && params.excludeIds.length > 0) {
    query = query.not("id", "in", `(${params.excludeIds.join(",")})`);
  }

  // LOCATION FIRST כשיש מיקום: bounding box geo (מרחק מדויק) אם יש
  // קואורדינטות אמיתיות, אחרת fallback לשם עיר מדויק. תיקון (בקשה
  // מפורשת - "לפני שעושים מיקום - אטרקציות רק מהמדינה שנמצאים בה!!!
  // לא מכל העולם"): קודם, בלי מיקום בכלל, לא היה שום סינון - זה החזיר
  // תוצאות מכל העולם, לא רק מהמדינה. TRIPLACE הוא אפליקציה ישראלית
  // (ר' collectionService.ts/profile-setup - "ישראל" כבר ברירת המחדל
   // הקיימת בכמה מקומות אחרים באפליקציה) - "כללי" עדיין אומר "מהמדינה
  // שבה אנחנו פועלים", לא "מכל העולם". זו עדיין לא "בחירת מיקום" אמיתית
  // (אין רדיוס/עיר ספציפיים) - רק תיחום למדינה, בלי להמציא מקומות.
  if (location.lat != null && location.lng != null) {
    const latDelta = kmToDegreesLat(radiusKm);
    const lngDelta = kmToDegreesLng(radiusKm, location.lat);
    query = query
      .gte("latitude", location.lat - latDelta)
      .lte("latitude", location.lat + latDelta)
      .gte("longitude", location.lng - lngDelta)
      .lte("longitude", location.lng + lngDelta);
  } else if (location.city) {
    query = query.eq("city", location.city);
  } else {
    query = query.eq("country", DEFAULT_DISCOVERY_COUNTRY);
  }

  // שולפים מעט יותר מהמכסה הסופית - הדירוג המשוקלל (computeWeightedScore)
  // קורה בקוד אחרי השליפה, כי הוא משלב מרחק+ביקורות+דירוג יחד, ולא ניתן
  // למיין לפי זה ישירות ב-SQL בלי פונקציה מותאמת ב-DB.
  const fetchLimit = Math.max((params.limit ?? 12) * 4, 40);
  const { data, error } = await query
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  if (error) {
    console.error("[discoveryService] שגיאת שליפת מקומות", { message: error.message, category: params.category });
    return [];
  }

  return (data ?? []) as PlaceRow[];
}

/**
 * מקומות בקטגוריה נתונה, רלוונטיים למיקום, מדורגים לפי ציון משוקלל.
 * זו הפונקציה שמשרתת כל קרוסלה "רגילה" בעמוד (עגלות קפה/תצפיות/וכו').
 */
export async function fetchDiscoveryPlaces(
  supabase: SupabaseClient,
  params: FetchDiscoveryPlacesParams
): Promise<DiscoveryPlace[]> {
  const rows = await queryPlaces(supabase, params);
  const origin: LatLng | null = params.location.lat != null && params.location.lng != null
    ? { lat: params.location.lat, lng: params.location.lng }
    : null;

  return rows
    .filter((row) => row.latitude != null && row.longitude != null || !origin)
    .map((row) => rowToDiscoveryPlace(row, origin))
    .sort((a, b) => computeWeightedScore(b) - computeWeightedScore(a))
    .slice(0, params.limit ?? 12);
}

/** קטגוריות "רלוונטיות לטיול יומי" ש"הכי חמים עכשיו" סורק ביחד - בכוונה
 *  לא כולל nightlife (חיי לילה) כברירת מחדל, כדי לא להציג בר בשעה
 *  שבה עמוד "הכי חם" נצפה בפועל בבוקר/צהריים; זה soft exclusion, לא
 *  Hard rule - עדיין ניתן לשנות בקלות ברשימה הזו בעתיד. */
const HOT_SCAN_CATEGORIES = [
  "coffee_carts_cafes",
  "nature_trails",
  "viewpoints",
  "shopping",
  "water_amusement_parks",
  "parks_gardens",
  "wineries_dining",
  "attractions_activities",
  "culture_history",
];

/** מקסימום תוצאות מאותה קטגוריה ב"הכי חמים עכשיו" - מונע "6 מסעדות"
 *  (דרישה מפורשת: "הכי חמים לא מציג רק מסעדות"), גם אם הן הכי מדורגות. */
const MAX_PER_CATEGORY_IN_HOT = 2;

export async function fetchHotPlaces(
  supabase: SupabaseClient,
  location: DiscoveryLocation,
  limit = 10,
  /** תיקון (Audit - "חופשה בארץ" צריך "הכי חמים עכשיו" שונה מ"טיול
   *  יומי" - קטגוריות רלוונטיות שונות, למשל כולל beaches_pools/
   *  spa_relaxation). ברירת המחדל (undefined) נשארת HOT_SCAN_CATEGORIES
   *  הקיים - "טיול יומי" ממשיך לעבוד בדיוק כמו קודם, בלי לשנות התנהגות
   *  קיימת. */
  categoriesOverride?: string[],
  /** תיקון (Audit - "חיי לילה ובילויים" צריך "הכי חמים עכשיו" שכולל
   *  nightlife): queryPlaces מדיר nightlife כברירת מחדל (ר' allowNightlife
   *  ב-queryPlaces) - בלי הפרמטר הזה, "הכי חמים עכשיו" בעמוד חיי לילה
   *  היה בשקט מדיר את כל המקומות שבאמת מתויגים category="nightlife",
   *  למרות ש-HOT_NIGHTLIFE_CATEGORIES כולל אותה במפורש. ברירת המחדל
   *  (false) לא משנה התנהגות קיימת בשום עמוד אחר. */
  allowNightlife = false
): Promise<DiscoveryPlace[]> {
  const rows = await queryPlaces(supabase, {
    location,
    categories: categoriesOverride ?? HOT_SCAN_CATEGORIES,
    allowNightlife,
    limit: limit * 3, // שולפים יותר כדי שיהיה ממה "לגוון" אחרי המכסה-לקטגוריה
  });
  const origin: LatLng | null = location.lat != null && location.lng != null ? { lat: location.lat, lng: location.lng } : null;

  const scored = rows
    .filter((row) => (row.latitude != null && row.longitude != null) || !origin)
    .map((row) => rowToDiscoveryPlace(row, origin))
    .sort((a, b) => computeWeightedScore(b) - computeWeightedScore(a));

  const result: DiscoveryPlace[] = [];
  const perCategoryCount = new Map<string, number>();
  for (const place of scored) {
    const count = perCategoryCount.get(place.category) ?? 0;
    if (count >= MAX_PER_CATEGORY_IN_HOT) continue;
    result.push(place);
    perCategoryCount.set(place.category, count + 1);
    if (result.length >= limit) break;
  }
  return result;
}

export interface DiscoveryEvent {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  locationLabel: string | null;
  city: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  category: string | null;
  linkUrl: string | null;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  location_label: string | null;
  city: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  link_url: string | null;
}

/**
 * אירועים פעילים ורלוונטיים למיקום (ADMIN בלבד - ר' migration 0052,
 * אין כאן שום קריאה חיצונית/AI, בדיוק לפי הדרישה המפורשת). "רלוונטי
 * לתאריך" = today נמצא בטווח [start_date, end_date] (כולל) - אירוע
 * שהסתיים לא חוזר, אירוע עתידי קרוב כן מוצג (לא רק "מתקיים עכשיו
 * הרגע" - הדרישה מפורשת: "מתקיים עכשיו או מתחיל בעתיד הקרוב").
 */
const UPCOMING_EVENTS_WINDOW_DAYS = 30;

export async function fetchActiveEvents(
  supabase: SupabaseClient,
  location: DiscoveryLocation,
  limit = 8
): Promise<DiscoveryEvent[]> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const windowEnd = new Date(today.getTime() + UPCOMING_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEndIso = windowEnd.toISOString().slice(0, 10);

  let query = supabase
    .from("admin_events")
    .select(
      "id,title,description,image_url,location_label,city,latitude,longitude,start_date,end_date,start_time,end_time,category,link_url"
    )
    .eq("status", "active")
    .lte("start_date", windowEndIso)
    .gte("end_date", todayIso);

  if (location.city) {
    query = query.eq("city", location.city);
  }

  const { data, error } = await query.order("start_date", { ascending: true }).limit(limit);
  if (error) {
    console.error("[discoveryService] שגיאת שליפת אירועים", { message: error.message });
    return [];
  }

  return ((data ?? []) as EventRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    locationLabel: row.location_label,
    city: row.city,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    category: row.category,
    linkUrl: row.link_url,
  }));
}
