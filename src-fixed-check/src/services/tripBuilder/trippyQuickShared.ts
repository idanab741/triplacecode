import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDiscoveryPlaces, type DiscoveryPlace, type DiscoveryLocation } from "@/services/places/discoveryService";
import { NIGHTLIFE_VENUE_TYPE_OPTIONS } from "@/locales/he/nightlife";
import { haversineDistanceKm, kmToDegreesLat, kmToDegreesLng } from "@/services/tripBuilder/geo";
import { AI_TRIP_BUILDER_SOURCE } from "@/services/tripBuilder/aiPlaceInsertionService";

/**
 * *** תוספת (בקשה מפורשת - "אם אכתוב טיול בטבע או חיי לילה או כל דבר
 * אחר עם טקסונומיה כזאת - תשנה בהתאם! שלא יהיה ריק שוב אף פעם!"):
 * מקובץ מרכזי אחד, כי שני ה-routes (חיפוש ראשי + swap בודד) צריכים
 * בדיוק את אותה לוגיקה. גילינו (ר' route.ts - היסטוריה) שיש **שלוש**
 * מנגנוני-סינון נפרדים לגמרי בקוד הזה, לא אחד:
 * 1. אטרקציות (טבע/תצפיות/תרבות/וכו') - trip_type_tags, categories:[...]
 * 2. מסעדות/בתי קפה (לפי מטבח) - category column + cuisine_tags
 * 3. חיי לילה (בר/מועדון/סטנדאפ/וכו') - PLACE_TYPE_TAGS + allowNightlife
 * "אטרקציה" גנרית לא מספיקה - כל אחד מהשלושה דורש טיפול שונה.
 */

export interface TrippyQuickStop {
  id: string;
  name: string;
  category: "attraction" | "restaurant" | "nightlife";
  shortDescription: string | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  /** *** תיקון (בקשת המשתמש - "ההחלפה צריכה להיות זהה!!! לאותה
   *  קטגוריה שביקשתי מלכתחילה!!!!! מסעדה אסייאתית - אז לקבל מסעדה
   *  אסייאתית!!!! לא סתם בית קפה"): לפני זה, ה-swap הסתמך על state
   *  נפרד בעמוד (searchContext) - אם הוא לא נטען/התעדכן בזמן (למשל
   *  race condition), ה-swap פשוט חיפש בלי סינון מטבח בכלל, ומצא כל
   *  מקום עם category="restaurants" (כולל עגלת קפה). עכשיו כל תחנה
   *  נושאת את התגים המדויקים שבאמת מצאו *אותה* - swap משתמש בהם
   *  ישירות מהתחנה עצמה, בלי תלות ב-state נפרד שעלול להיות ריק. */
  searchTags: string[];
  /** *** תוספת - ר' fetchPlacesByNameKeyword למטה. null אם החיפוש היה
   *  לפי קטגוריה/מטבח רגיל (לא מנה ספציפית). */
  nameKeyword: string | null;
}

/** ר' route.ts - בדיקה אמפירית אמיתית מול ה-DB (לא ניחוש), מתועדת
 *  ב-restaurants-cafes/route.ts - הערכים התיאורטיים ב-CUISINE_TAGS לא
 *  תמיד תואמים את מה שבאמת שמור בעמודת cuisine_tags. */
const CUISINE_ID_TO_REAL_DB_TAGS: Record<string, string[]> = {
  israeli_middle_eastern: ["israeli_middle_eastern", "israeli", "middle_eastern"],
  italian: ["italian"],
  asian: ["asian"],
  meat_grill: ["meat_bbq", "bbq", "meat_grill", "steakhouse"],
  burger: ["burger_diner", "burger"],
  mexican: ["mexican"],
  greek: ["greek"],
  french_bistro: ["french_bistro"],
  indian: ["indian"],
  mediterranean: ["mediterranean", "Mediterranean"],
  seafood: ["seafood"],
  pizza: ["pizza"],
  breakfast_brunch: ["breakfast_brunch", "brunch"],
  cafe: ["cafe"],
  desserts: ["desserts_sweets", "desserts"],
  salads_healthy: ["salads_healthy"],
};

export function toRealCuisineTags(cuisineIds: string[]): string[] {
  return cuisineIds.flatMap((id) => CUISINE_ID_TO_REAL_DB_TAGS[id] ?? [id]);
}

/** 10 הערכים האמיתיים לחיי לילה - ר' nightlife/route.ts. */
export const NIGHTLIFE_TAG_IDS = NIGHTLIFE_VENUE_TYPE_OPTIONS.map((o) => o.value);

export function toStop(
  place: DiscoveryPlace,
  category: TrippyQuickStop["category"],
  searchTags: string[],
  nameKeyword: string | null = null
): TrippyQuickStop | null {
  if (place.latitude == null || place.longitude == null) return null;
  return {
    id: place.id,
    name: place.name,
    category,
    shortDescription: place.shortDescription,
    imageUrl: place.imageUrls[0] ?? null,
    address: place.city,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    searchTags,
    nameKeyword,
  };
}

/** ר' route.ts - fetchDiscoveryPlaces מרחיב אוטומטית רדיוס עד 120 ק"מ
 *  אם יש מעט תוצאות (נכון לשאר האפליקציה) - כאן, כשאין עיר מפורשת,
 *  מסננים בחזרה ל-10 ק"מ אמיתיים אחרי השליפה. */
export const NO_CITY_MAX_DISTANCE_KM = 10;
export function filterByDistanceIfNoCity(places: DiscoveryPlace[], hasExplicitCity: boolean): DiscoveryPlace[] {
  if (hasExplicitCity) return places;
  return places.filter((p) => p.distanceKm == null || p.distanceKm <= NO_CITY_MAX_DISTANCE_KM);
}

interface FetchBucketParams {
  supabase: SupabaseClient;
  location: DiscoveryLocation;
  hasExplicitCity: boolean;
  limit: number;
  excludeIds?: string[];
  /** *** תוספת (בקשת המשתמש - "פער של עד קילומטר בין אטרקציה
   *  לאטרקציה! לא מעבר!!"): מספר המועמדים שנשלפים בפועל מה-DB, גדול
   *  מ-limit (המכסה הסופית שהמשתמש ביקש) - כדי ש-pickCompactCluster
   *  למטה יהיה לו ממה לבחור תת-קבוצה שבאמת קרובה גיאוגרפית זו לזו,
   *  לא רק "הכי מדורגים" בלי קשר למרחק ביניהם. */
  poolSize?: number;
}

export async function fetchAttractionPlaces(
  params: FetchBucketParams & { attractionCategoryIds: string[] }
): Promise<DiscoveryPlace[]> {
  if (params.limit <= 0 || params.attractionCategoryIds.length === 0) return [];
  const raw = await fetchDiscoveryPlaces(params.supabase, {
    location: params.location,
    categories: params.attractionCategoryIds,
    limit: params.poolSize ?? params.limit,
    radiusKm: params.hasExplicitCity ? undefined : NO_CITY_MAX_DISTANCE_KM,
    excludeIds: params.excludeIds,
  });
  return filterByDistanceIfNoCity(raw, params.hasExplicitCity);
}

export async function fetchRestaurantPlaces(
  params: FetchBucketParams & { cuisineIds: string[] }
): Promise<DiscoveryPlace[]> {
  if (params.limit <= 0) return [];
  const raw = await fetchDiscoveryPlaces(params.supabase, {
    location: params.location,
    categoryColumnEquals: "restaurants",
    requiredAnyCuisineTags: params.cuisineIds.length > 0 ? toRealCuisineTags(params.cuisineIds) : undefined,
    limit: params.poolSize ?? params.limit,
    radiusKm: params.hasExplicitCity ? undefined : NO_CITY_MAX_DISTANCE_KM,
    excludeIds: params.excludeIds,
  });
  return filterByDistanceIfNoCity(raw, params.hasExplicitCity);
}

export async function fetchNightlifePlaces(
  params: FetchBucketParams & { nightlifeTagIds: string[] }
): Promise<DiscoveryPlace[]> {
  if (params.limit <= 0 || params.nightlifeTagIds.length === 0) return [];
  const raw = await fetchDiscoveryPlaces(params.supabase, {
    location: params.location,
    requiredAnyTags: params.nightlifeTagIds,
    allowNightlife: true,
    limit: params.poolSize ?? params.limit,
    radiusKm: params.hasExplicitCity ? undefined : NO_CITY_MAX_DISTANCE_KM,
    excludeIds: params.excludeIds,
  });
  return filterByDistanceIfNoCity(raw, params.hasExplicitCity);
}

/**
 * *** תוספת (בקשת המשתמש - "לא צריך 2 פארקים לצורך הדוגמה מספיק
 * אחד. וצריך פער של עד קילומטר בין אטרקציה לאטרקציה! לא מעבר!!",
 * ואז - "הוא תמיד מציע עד 2 אופציות. למה לא יותר??" -> "להרחיב את
 * הרדיוס רק כשחסר (למשל עד 2-3 ק"מ) כדי להגיע לכמות המבוקשת"):
 * fetchDiscoveryPlaces (ר' discoveryService.ts) מדרג לפי ציון משוקלל
 * (דירוג+מרחק *מהמשתמש*), לא לפי מרחק הדדי בין התחנות שנבחרו - שתי
 * תחנות "מובילות" יכולות בקלות להיות כל אחת קרובה למשתמש אבל רחוקות
 * זו מזו (למשל שני קצוות של אותה עיר). הפונקציה הזו מקבלת "בריכות"
 * מועמדים גדולות מכל אחד משלושת הבאקטים (attraction/restaurant/
 * nightlife - כל אחת כבר ממוינת לפי הציון המשוקלל שלה), ובוחרת
 * "עוגן" (התחנה עם הציון הכי גבוה מבין כל המועמדים) - ואז ממלאת כל
 * מכסה מסביב לעוגן, **מנסה תחילה ברדיוס הדוק (1 ק"מ)**, ורק אם זה לא
 * מספיק כדי למלא את המכסה המבוקשת, מרחיבה בהדרגה (2 ק"מ, ואז 3 ק"מ) -
 * לא הכל-או-כלום כמו קודם, ולא ישר "רדיוס-על" בלי הגבלה. אם גם ב-3
 * ק"מ אין מספיק - מוצג פחות (עדיין העיקרון הקיים: "מוצג פחות, לא
 * מוצג לא-רלוונטי/רחוק מדי").
 */
export const GAP_RADII_KM = [1, 2, 3];

export interface ClusterQuotas {
  attraction: number;
  restaurant: number;
  nightlife: number;
}

export interface ClusterPools {
  attraction: DiscoveryPlace[];
  restaurant: DiscoveryPlace[];
  nightlife: DiscoveryPlace[];
}

export function pickCompactCluster(pools: ClusterPools, quotas: ClusterQuotas): ClusterPools {
  type Bucket = keyof ClusterPools;
  const buckets: Bucket[] = ["attraction", "restaurant", "nightlife"];

  const withCoords = (list: DiscoveryPlace[]) => list.filter((p) => p.latitude != null && p.longitude != null);
  const pools2: ClusterPools = {
    attraction: withCoords(pools.attraction),
    restaurant: withCoords(pools.restaurant),
    nightlife: withCoords(pools.nightlife),
  };

  const all: { place: DiscoveryPlace; bucket: Bucket }[] = buckets.flatMap((bucket) =>
    pools2[bucket].map((place) => ({ place, bucket }))
  );
  if (all.length === 0) return { attraction: [], restaurant: [], nightlife: [] };

  /** *** תוספת (בקשת המשתמש - "לא צריך 2 פארקים לצורך הדוגמה"): בוחר
   *  עד `quota` תחנות מתוך `within` (כבר ממוין לפי ציון), **מעדיף
   *  תת-קטגוריה שונה** לכל תחנה נבחרת - כדי שכש-quota>1 לא ייבחרו שתי
   *  תחנות "כמעט זהות" (שני פארקים, שני בתי קפה וכו'). אם אין מספיק
   *  תת-קטגוריות שונות בסביבה כדי למלא את המכסה, ממלאים את השאר
   *  מהשאריות (עדיף תחנה חוזרת-סוג על פחות תחנות מהמבוקש). */
  function pickDiverseWithinBucket(within: DiscoveryPlace[], quota: number): DiscoveryPlace[] {
    if (quota <= 0) return [];
    const chosen: DiscoveryPlace[] = [];
    const usedSubcategories = new Set<string>();
    for (const place of within) {
      if (chosen.length >= quota) break;
      const key = place.subcategory ?? place.category;
      if (usedSubcategories.has(key)) continue;
      chosen.push(place);
      usedSubcategories.add(key);
    }
    if (chosen.length < quota) {
      for (const place of within) {
        if (chosen.length >= quota) break;
        if (!chosen.includes(place)) chosen.push(place);
      }
    }
    return chosen;
  }

  function pickForAnchor(anchor: DiscoveryPlace): ClusterPools {
    const anchorLatLng = { lat: anchor.latitude!, lng: anchor.longitude! };
    const result: ClusterPools = { attraction: [], restaurant: [], nightlife: [] };
    for (const bucket of buckets) {
      // *** מנסים תחילה את הרדיוס ההדוק ביותר (1 ק"מ) - רק אם הוא לא
      // מספיק כדי למלא את המכסה המבוקשת, מרחיבים בהדרגה (2, אז 3 ק"מ).
      // כל ניסיון מחליף את הקודם (לא מצטבר) - ברדיוס גדול יותר, כל
      // מועמדי הרדיוס הקטן ממילא כלולים, אז אין אובדן דיוק.
      let chosen: DiscoveryPlace[] = [];
      for (const radiusKm of GAP_RADII_KM) {
        if (chosen.length >= quotas[bucket]) break;
        const within = pools2[bucket].filter(
          (p) => haversineDistanceKm(anchorLatLng, { lat: p.latitude!, lng: p.longitude! }) <= radiusKm
        );
        // כבר ממוין לפי ציון משוקלל (הגיע ככה מ-fetchDiscoveryPlaces) - בוחרים בגיוון, לא רק חותכים
        chosen = pickDiverseWithinBucket(within, quotas[bucket]);
      }
      result[bucket] = chosen;
    }
    return result;
  }

  function totalFilled(res: ClusterPools): number {
    return res.attraction.length + res.restaurant.length + res.nightlife.length;
  }

  // עוגנים מועמדים: עד 15 הכי-מדורגים מכל המועמדים (לא כולם - עלות
  // O(n²) קטנה בכוונה, מספיק כדי למצוא אשכול טוב בלי לסרוק הכל).
  const anchorCandidates = all.slice(0, 15);
  let best = pickForAnchor(anchorCandidates[0].place);
  let bestScore = totalFilled(best);
  for (const candidate of anchorCandidates.slice(1)) {
    const res = pickForAnchor(candidate.place);
    const score = totalFilled(res);
    if (score > bestScore) {
      best = res;
      bestScore = score;
    }
  }
  return best;
}

/**
 * *** תיקון (בקשת המשתמש - "ביקשתי חומוס - קיבלתי ג'סמינו (אין שם
 * חומוס)... ואז בהחלפה - קיבלתי משהו שבכלל לא קשור"): הטקסונומיה
 * (CUISINE_TAGS, 16 ערכים) היא **גסה מדי** למנות ספציפיות כמו "חומוס"/
 * "סושי"/"פיצה נאפוליטנית" - הכי קרוב זמין (למשל
 * "israeli_middle_eastern") מכסה טווח רחב מדי, ולא מבטיח שהמקום
 * *באמת* מוכר חומוס. הפתרון: כשהבקשה מציינת מנה/מילת-מפתח ספציפית
 * שלא נתפסת נכון על ידי אף cuisine tag, מחפשים ישירות לפי הימצאות
 * המילה בשם המקום/בתיאור שלו (ILIKE) - לא מנחשים "הכי קרוב", מוצאים
 * את המקום שבאמת מזכיר את זה.
 */
export async function fetchPlacesByNameKeyword(params: {
  supabase: SupabaseClient;
  keyword: string;
  location: DiscoveryLocation;
  limit: number;
  excludeIds?: string[];
}): Promise<DiscoveryPlace[]> {
  if (params.limit <= 0 || !params.keyword.trim()) return [];
  const { supabase, keyword, location, limit, excludeIds } = params;

  let query = supabase
    .from("places")
    .select("id,name,category,subcategory,short_description,image_urls,rating,rating_count,city,latitude,longitude,tags,opening_hours")
    .eq("is_legacy", false)
    .neq("source", AI_TRIP_BUILDER_SOURCE)
    .eq("category", "restaurants")
    .or(`name.ilike.%${keyword}%,short_description.ilike.%${keyword}%`);

  if (excludeIds && excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const radiusKm = NO_CITY_MAX_DISTANCE_KM;
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
  }

  const { data, error } = await query.order("rating", { ascending: false, nullsFirst: false }).limit(limit * 4);
  if (error || !data) return [];

  const origin = location.lat != null && location.lng != null ? { lat: location.lat, lng: location.lng } : null;
  return data
    .map(
      (row): DiscoveryPlace => ({
        id: row.id,
        name: row.name,
        category: row.category,
        subcategory: row.subcategory,
        subcategoryLabel: null,
        shortDescription: row.short_description,
        imageUrls: row.image_urls ?? [],
        rating: row.rating,
        ratingCount: row.rating_count,
        city: row.city,
        distanceKm: origin && row.latitude != null && row.longitude != null ? haversineDistanceKm(origin, { lat: row.latitude, lng: row.longitude }) : null,
        tags: row.tags ?? [],
        latitude: row.latitude,
        longitude: row.longitude,
        openingHours: row.opening_hours ?? null,
      })
    )
    .filter((p) => p.distanceKm == null || location.city != null || p.distanceKm <= radiusKm)
    .slice(0, limit);
}
