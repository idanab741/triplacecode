import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm, kmToDegreesLat, kmToDegreesLng } from "@/services/tripBuilder/geo";
import type { LatLng } from "@/services/tripBuilder/types";
import { AI_TRIP_BUILDER_SOURCE } from "@/services/tripBuilder/aiPlaceInsertionService";
import { getSubcategoryLabel, TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";

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
  /** תיקון (Audit - "מפה עם מיקום ונעץ של כל המקומות"): נחוץ להצגת
   *  סמנים על מפה בעמוד "ראה הכל" (DiscoveryPlacesMap.tsx) - לא היה
   *  חשוף קודם על DiscoveryPlace (רק בשימוש פנימי לחישוב distanceKm). */
  latitude: number | null;
  longitude: number | null;
  /** *** תוספת (בקשת המשתמש - "ג'סמינו בכלל סגור בשבת" - trippy-quick
   *  הציע מסעדה סגורה ביום שהמשתמש ביקש טיול בו): שעות פתיחה גולמיות
   *  (כמו ב-finalizeService.ts/validationService.ts) - שדה נוסף בלבד,
   *  לא משנה התנהגות לאף צרכן קיים של DiscoveryPlace שלא משתמש בו. */
  openingHours: string[] | null;
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
  "id,name,category,subcategory,short_description,image_urls,rating,rating_count,city,latitude,longitude,tags,opening_hours";

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
  opening_hours: string[] | null;
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
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.opening_hours ?? null,
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
 * תיקון באג אמיתי וקריטי ("לא הגיוני ש3/4 ריק! יש שם המון המון
 * אטרקציות שהכנסתי"): מצאתי את הסיבה בפועל בקוד האדמין עצמו
 * (src/app/admin/places/[id]/page.tsx) - יש שם הערה ואזהרה מפורשות:
 * "מנוע החיפוש... בודק רק trip_type_tags" ו-"⚠️ קטגוריה ראשית... צריכה
 * לפחות אחת מהתגיות... ללא זה, המקום לא יוחזר כמועמד". כלומר: trip_type_tags
 * הוא שדה **נפרד ואופציונלי** בטופס האדמין (multi-select שקל לשכוח),
 * בעוד ש-subcategory הוא השדה שה-admin בפועל תמיד ממלא (זה "התת-קטגוריה
 * (סוג מדויק)" - הבחירה המרכזית כשמוסיפים מקום). ההתאמה המחמירה-בלבד
 * לפי trip_type_tags (שהוספתי בסבב קודם כדי לתקן "עגלת קפה מציגה
 * מסעדות") הייתה נכונה *בכיוון* אבל שגויה *במנגנון* - היא סיננה החוצה
 * בטעות גם מקומות עם subcategory מדויק ונכון, רק כי trip_type_tags
 * נשאר ריק. בגלל זה 3/4 מהסקשנים יצאו ריקים, למרות שהמקומות קיימים.
 *
 * התיקון: subcategory לבדו (ר' params.subcategories למטה) הוא **מספיק**
 * להתאמה - לא דורש גם trip_type_tags. זה עדיין מדויק (subcategory="forest"
 * שייך רק ל-nature_trails באמת, לא יכול "לדלוף" ל-coffee_carts_cafes) -
 * ועדיין פותר את הבעיה המקורית (עגלת קפה לא תופיע בטבע, כי ל-subcategory
 * שלה אין שום קשר ל-nature_trails). וכש-category/categories מועבר בלי
 * subcategories מפורש (סקשן "רחב", כמו "ספא ורוגע" שלא מסנן subcategory
 * ספציפי) - עכשיו גם subcategory שמשתייך לקבוצת הטקסונומיה הזו (מתוך
 * TRIP_TYPE_GROUPS הקיים, לא רשימה חדשה) מספיק, לא רק trip_type_tags.ov.
 */
const CATEGORY_ALL_SUBCATEGORIES: Record<string, string[]> = {};
for (const group of TRIP_TYPE_GROUPS) {
  CATEGORY_ALL_SUBCATEGORIES[group.id] = group.subTags.map((s) => s.id);
}

function buildCategoryOrFilter(categoryIds: string[]): string {
  const clauses = categoryIds.map((categoryId) => `trip_type_tags.ov.{${categoryId}}`);
  const allSubcategories = categoryIds.flatMap((id) => CATEGORY_ALL_SUBCATEGORIES[id] ?? []);
  if (allSubcategories.length > 0) {
    clauses.push(`subcategory.in.(${allSubcategories.join(",")})`);
  }
  return clauses.join(",");
}

/**
 * *** הוסר לגמרי (תיקון Product מפורש - "איך זה קשור פה??? אני רוצה
 * שהכל יהיה מדויק... הכל צריך להיות 100% דיוק!!"): נסיתי כאן קודם
 * Fallback עם מילות-מפתח מטושטשות/מיפוי לקטגוריה גסה כשההתאמה המדויקת
 * חוזרת עם מעט תוצאות - זה גרם ל"ספא" להראות חופים, ו"יקב או בר יין"
 * להראות מסעדות רגילות לגמרי לא קשורות (שתיהן category="attractions"/
 * "restaurants" הגס, אבל לא ספא/יקב באמת). המשתמש דחה את זה בפירוש -
 * דיוק גובר על כיסוי. במקום זאת, כשההתאמה המדויקת חוזרת עם מעט
 * תוצאות, מרחיבים את **רדיוס החיפוש** (לא את הקטגוריה!) - ר'
 * fetchDiscoveryPlaces למטה. "אם אין לך מיקום - אפשר להתרחק מהיעד" -
 * בדיוק ההנחיה שניתנה.
 */

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
  /** *** תוספת (Admin Places - "כל האטרקציות, כל המדינות, לא רק ליד
   *  המשתמש"): כשאין location בכלל, ברירת המחדל הקיימת (queryPlaces
   *  למטה) מגבילה ל-country="ישראל" - נכון לצרכן באפליקציה (שם "כללי"
   *  תמיד אומר "בישראל"), לא נכון לאדמין שרוצה לדפדף בכל מדינה. שני
   *  שדות חדשים, אופציונליים לגמרי - קריאות קיימות (day-trip/nature-trip/
   *  ...discovery routes) לא מעבירות אותם, אז ההתנהגות שלהן לא משתנה
   *  כלל. country דורס את ברירת המחדל "ישראל" למדינה ספציפית; worldwide
   *  מבטל לגמרי את סינון המדינה (כל העולם). country גובר אם שניהם
   *  הועברו בטעות. */
  country?: string;
  worldwide?: boolean;
  /** *** תוספת (באג אמיתי - "תל אביב מציגה מלונות מירושלים/ים המלח"):
   *  ה-Fallback הקיים למטה (הרחבת רדיוס ל-MAX_DISCOVERY_RADIUS_KM=120
   *  ק"מ כשיש מעט תוצאות) הוא בכוונה תכונת מוצר לצרכן באפליקציה ("עדיף
   *  להראות משהו רחוק מלהראות ריק") - לא לגעת בו שם. אבל בעמוד יעד
   *  ספציפי באדמין ("חופשה בארץ" → תל אביב) המטרה היא בדיוק הפוכה:
   *  להראות *רק* מה שבאמת ביעד הזה, גם אם זה אומר פחות תוצאות. true
   *  מבטל את ההרחבה לגמרי עבור הקריאה הזו בלבד - קריאות קיימות
   *  (day-trip/nature-trip/vacation-il/TripMatch...) לא מעבירות את זה,
   *  אז ההתנהגות שלהן לא משתנה כלל. */
  disableRadiusExpansion?: boolean;
}

/** בונה שאילתת bounding box + city fallback - אותו דפוס בדיוק כמו
 *  candidatePoolService.ts (queryPool), לא מנגנון מיקום חדש.
 *  radiusOverrideKm (אופציונלי): כשמועבר, משמש במקום params.radiusKm/
 *  DEFAULT_DISCOVERY_RADIUS_KM - ר' fetchDiscoveryPlaces להסבר (הרחבת
 *  רדיוס כ-fallback, לא הרחבת קטגוריה - ר' הערה שם). */
async function queryPlaces(
  supabase: SupabaseClient,
  params: FetchDiscoveryPlacesParams,
  radiusOverrideKm?: number
): Promise<PlaceRow[]> {
  const { location } = params;
  const radiusKm = Math.min(radiusOverrideKm ?? params.radiusKm ?? DEFAULT_DISCOVERY_RADIUS_KM, MAX_DISCOVERY_RADIUS_KM);

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

  // *** ההתאמה כאן היא **תמיד** מדויקת (trip_type_tags.ov/subcategory.in/
  // category.eq) - שום מצב "מטושטש" בעמודה הזו. תיקון Product מפורש
  // ("אני רוצה שהכל יהיה מדויק... 100% דיוק!!") - ניסיתי בעבר Fallback
  // עם קטגוריה גסה יותר כשתוצאות היו מעטות, וזה גרם ל"ספא" להראות
  // חופים ול"יקב" להראות מסעדות סתמיות - הוסר לגמרי. הפתרון היחיד
  // שנשאר ל"תוצאות מעטות" הוא הרחבת **רדיוס החיפוש** (radiusOverrideKm
  // למעלה), לא שינוי הקטגוריה.
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
  } else if (params.country) {
    // *** Admin Places - מדינה ספציפית שנבחרה בפילטר, לא ברירת המחדל
    // "ישראל" (ר' ההערה על country/worldwide ב-FetchDiscoveryPlacesParams).
    query = query.eq("country", params.country);
  } else if (params.worldwide) {
    // *** Admin Places - "כל האטרקציות" בלי הגבלת מדינה כלל.
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

  // *** Fallback: הרחבת רדיוס בלבד, לא קטגוריה (תיקון Product מפורש -
  // "אם אין לך מיקום - אפשר להתרחק מהיעד! לא לשים סתם דברים ולמחזר...
  // הכל צריך להיות 100% דיוק"). כשההתאמה המדויקת (עם רדיוס החיפוש
  // הרגיל) חזרה עם מעט תוצאות, ומדובר בחיפוש עם מיקום geo אמיתי (לא
  // city fallback טקסטואלי, שאין לו "רדיוס" בכלל) - מנסים שוב עם
  // MAX_DISCOVERY_RADIUS_KM, **אותה קטגוריה בדיוק**. אם עדיין אין
  // מספיק - מוצג פחות, לא מוצג לא-רלוונטי.
  let combinedRows = rows;
  const hasGeoLocation = params.location.lat != null && params.location.lng != null;
  const currentRadiusKm = Math.min(params.radiusKm ?? DEFAULT_DISCOVERY_RADIUS_KM, MAX_DISCOVERY_RADIUS_KM);
  if (!params.disableRadiusExpansion && hasGeoLocation && rows.length < (params.limit ?? 12) && currentRadiusKm < MAX_DISCOVERY_RADIUS_KM) {
    const widerRows = await queryPlaces(supabase, params, MAX_DISCOVERY_RADIUS_KM);
    const seenIds = new Set(rows.map((r) => r.id));
    combinedRows = [...rows, ...widerRows.filter((r) => !seenIds.has(r.id))];
  }

  const origin: LatLng | null = params.location.lat != null && params.location.lng != null
    ? { lat: params.location.lat, lng: params.location.lng }
    : null;

  return combinedRows
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
