import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm } from "./geo";
import { createAdminClient } from "@/services/supabase/admin";
import { AI_TRIP_BUILDER_SOURCE } from "./aiPlaceInsertionService";
import type { CandidatePlace, LatLng } from "./types";

interface MustSeeParams {
  destination: string;
  vacationTypeLabels: string[];
  freeText: string;
  /** בקשה מפורשת ("חסר לי הקוליזיאום, המדרגות הספרדיות, הוותיקן!") - תקרה
   *  קבועה של "3 עד 6" הייתה נמוכה מדי לטיולים ארוכים/יעדים עשירים כמו
   *  רומא (יש בקלות 10+ אתרים מובהקים). נגזר ממספר סלוטי ה"אטרקציה"
   *  שבאמת יש בטיול - לא הגיוני לבקש יותר ממה שיש לאן לשבץ, אבל גם לא
   *  לתקוע תקרה שרירותית נמוכה כשיש הרבה מקום.
   */
  maxCount: number;
}

/**
 * בקשה מפורשת: "לא הגיוני שבטיול רומנטי לפריז אין התייחסות למגדל אייפל
 * ושייט בנהר הסיין" - Claude (בלי שום קריאת Google API) מציע רשימה
 * של האתרים/החוויות ה"מובהקים" ביותר של היעד, עד מספר שנגזר מאורך
 * הטיול בפועל (לא תקרה קבועה) - עם עדיפות לאתרים שמתאימים לאופי הטיול
 * הספציפי (רומנטי/משפחתי/וכו') כשזה רלוונטי.
 * הרשימה הזו היא רק *הצעות שמות* - findMustSeePlaces (למטה) הוא זה
 * שבודק בפועל מה מהם קיים אצלנו במאגר, ורק אלה נכנסים למסלול בוודאות.
 */
export async function suggestMustSeeLandmarks(params: MustSeeParams): Promise<string[]> {
  const count = Math.max(3, Math.min(15, params.maxCount));
  const prompt = `אתה מומחה טיולים עולמי. עבור היעד "${params.destination}", תן רשימה של עד
${count} מהאתרים/החוויות ה"מובהקים" ביותר - הסמלים המוכרים והמפורסמים ביותר
של היעד הזה, שכל מבקר ראשון-פעם צריך לשקול לכלול בטיול (למשל בפריז: מגדל
אייפל, שייט בנהר הסיין; ברומא: הקולוסאום, מזרקת טרווי, הוותיקן, הקפלה
הסיסטינית, המדרגות הספרדיות). אם ליעד יש פחות מ-${count} אתרים מובהקים
אמיתיים - אל תמלא במכסה בכוח, תן רק את מה שבאמת ראוי.

חשוב - התאמה לאופי הטיול הספציפי: אם ההקשר הבא מרמז על אופי מסוים, תן עדיפות
לאתרים/חוויות שמתאימים לו במיוחד, לא רק לרשימת "חובה" גנרית. לדוגמה: אם ההקשר
רומנטי (בן/בת זוג, ירח דבש, המילה "רומנטי") - העדף חוויות רומנטיות מובהקות
(שייט זוגי, נקודת תצפית לשקיעה) על פני אתרים כלליים גדולים (מוזיאון ענק,
קניון). אם ההקשר משפחתי עם ילדים קטנים - העדף אתרים שמתאימים לגיל.

סוג חופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
בקשה חופשית מהמשתמש: ${JSON.stringify(params.freeText || null)}

השב אך ורק במבנה JSON הבא - מערך שמות בלבד, בלי תיאור, בלי שום טקסט נוסף:
["שם אתר/חוויה 1", "שם אתר/חוויה 2", ...]`;

  const { text, error } = await callClaude(prompt, 500);
  if (error || !text) {
    logAiError("הצעת אתרי חובה נכשלה - ממשיכים בלי אתרי חובה", { destination: params.destination, error });
    return [];
  }

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  } catch (parseError) {
    logAiError("כשל בפענוח אתרי חובה", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      destination: params.destination,
    });
    return [];
  }
}

/**
 * תיקון קריטי: קודם הפונקציה הזו סיננה לפי `.ilike("city", "%"+city+"%")`,
 * כש-city היה destinationName. הבעיה: כשהיעד הגיע מ-pickSurpriseDestination
 * (זרימת "אמשיך לבד"), destinationName נשמר בפורמט "עיר, מדינה" (למשל
 * "רומא, איטליה") - אבל עמודת places.city היא בדרך כלל רק שם העיר לבד
 * ("רומא"), בלי המדינה. "רומא" לא *מכיל* את המחרוזת "רומא, איטליה"
 * כתת-מחרוזת - כך שההתאמה נכשלה תמיד בדיוק בזרימה שהכי משנה (זו
 * שהוספתי!), וכל אתרי החובה נשמטו בשקט בלי שום שם נמצא.
 *
 * התיקון: לא מסתמכים על התאמת מחרוזת ל-city בכלל - מסננים לפי **מרחק
 * גיאוגרפי אמיתי** ממרכז היעד (origin/maxDistanceKm, בדיוק כמו
 * fetchCandidatePool), חסין לגמרי לפורמט/ניסוח/שפה של עמודת city.
 */
export async function findMustSeePlaces(
  supabase: SupabaseClient,
  rawNames: string[],
  origin: LatLng,
  maxDistanceKm: number,
  destination: string
): Promise<CandidatePlace[]> {
  const results: CandidatePlace[] = [];
  const usedIds = new Set<string>();

  for (const name of rawNames) {
    const normalizedName = name.trim();
    if (!normalizedName) continue;

    // לא מסננים לפי city בשאילתה עצמה (חסין לפורמט "עיר"/"עיר, מדינה"/
    // שפה) - שולפים כמה התאמות שם ומסננים לפי מרחק אמיתי מהיעד ב-JS,
    // בדיוק כמו שאר קוד בניית הטיול עובד עם מרחקים (לא שמות ערים).
    const { data } = await supabase
      .from("places")
      .select(
        "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience"
      )
      .eq("is_legacy", false)
      .ilike("name", `%${normalizedName}%`)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(10);

    const withinRange = (data ?? []).find((row) => {
      if (usedIds.has(row.id as string)) return false;
      const distanceKm = haversineDistanceKm(origin, { lat: row.latitude as number, lng: row.longitude as number });
      return distanceKm <= maxDistanceKm;
    });

    if (withinRange) {
      usedIds.add(withinRange.id as string);
      results.push({
        id: withinRange.id,
        name: withinRange.name,
        category: withinRange.category,
        subcategory: withinRange.subcategory,
        shortDescription: withinRange.short_description,
        imageUrls: withinRange.image_urls ?? [],
        rating: withinRange.rating,
        ratingCount: withinRange.rating_count,
        priceLevel: withinRange.price_level,
        estimatedVisitMinutes: withinRange.estimated_visit_minutes,
        latitude: withinRange.latitude,
        longitude: withinRange.longitude,
        distanceKm: haversineDistanceKm(origin, { lat: withinRange.latitude, lng: withinRange.longitude }),
        etaMinutes: 0,
        tripTypeTags: withinRange.trip_type_tags ?? [],
        cuisineTags: withinRange.cuisine_tags ?? [],
        kosher: withinRange.kosher,
        accessible: withinRange.accessible,
        suitableChildAges: withinRange.suitable_child_ages ?? [],
        budgetTier: withinRange.budget_tier,
        isAreaExperience: withinRange.is_area_experience ?? false,
        reason: "אתר חובה מובהק ביעד",
        source: "fallback",
      });
      continue;
    }

    // בקשה מפורשת: "חייבות להופיע אטרקציות חובה!" - אם אתר החובה לא קיים
    // אצלנו במאגר, לא משמיטים אותו בשקט. מאמתים אותו מול Google Places
    // (שם אמיתי, קואורדינטות, דירוג, תמונה) ושומרים כשורה חדשה - מסומן
    // AI_TRIP_BUILDER_SOURCE (לא "תוכן אדמין", בדיוק כמו כל מקום אחר
    // שה-AI יוצר בבניית טיול, ר' aiPlaceInsertionService.ts) כדי שלא
    // "יזהם" בשקט חיפושים עתידיים של "המאגר שלנו".
    const created = await createMustSeePlaceViaGoogle(normalizedName, destination, origin, maxDistanceKm);
    if (!created || usedIds.has(created.id)) continue;
    usedIds.add(created.id);
    results.push(created);
  }
  return results;
}

interface GooglePlaceTextSearchResult {
  place_id?: string;
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  photos?: { photo_reference?: string }[];
}

/**
 * מאמת אתר-חובה מול Google Places Text Search (שם + קואורדינטות + דירוג +
 * תמונה אמיתיים - לא ניחוש), ושומר אותו כשורה חדשה בטבלת places אם הוא
 * בטווח הסביר מהיעד. בלי מפתח API מוגדר - מוותרים בשקט (לא עוצרים בנייה).
 */
async function createMustSeePlaceViaGoogle(
  name: string,
  destination: string,
  origin: LatLng,
  maxDistanceKm: number
): Promise<CandidatePlace | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const query = `${name} ${destination}`;
    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}` +
      `&location=${origin.lat},${origin.lng}&radius=${Math.round(maxDistanceKm * 1000)}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const top = (data?.results?.[0] ?? null) as GooglePlaceTextSearchResult | null;
    const location = top?.geometry?.location;
    if (!top?.name || !location) return null;

    const distanceKm = haversineDistanceKm(origin, { lat: location.lat, lng: location.lng });
    if (distanceKm > maxDistanceKm) return null;

    const photoRef = top.photos?.[0]?.photo_reference;
    const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];

    const supabaseAdmin = createAdminClient();
    const { data: inserted, error } = await supabaseAdmin
      .from("places")
      .insert({
        name: top.name,
        city: destination,
        category: "attractions",
        short_description: null,
        image_urls: imageUrls,
        rating: top.rating ?? null,
        rating_count: top.user_ratings_total ?? null,
        latitude: location.lat,
        longitude: location.lng,
        trip_type_tags: ["must_see_landmarks"],
        source: AI_TRIP_BUILDER_SOURCE,
      })
      .select("id")
      .single();

    if (error || !inserted) return null;

    return {
      id: inserted.id as string,
      name: top.name,
      category: "attractions",
      subcategory: null,
      shortDescription: null,
      imageUrls,
      rating: top.rating ?? null,
      ratingCount: top.user_ratings_total ?? null,
      priceLevel: null,
      estimatedVisitMinutes: null,
      latitude: location.lat,
      longitude: location.lng,
      distanceKm,
      etaMinutes: 0,
      tripTypeTags: ["must_see_landmarks"],
      cuisineTags: [],
      kosher: null,
      accessible: null,
      suitableChildAges: [],
      budgetTier: null,
      isAreaExperience: false,
      reason: "אתר חובה מובהק ביעד (אומת מול Google, לא היה עדיין במאגר שלנו)",
      source: "fallback",
    };
  } catch (error) {
    logAiError("יצירת אתר חובה דרך Google נכשלה", {
      message: error instanceof Error ? error.message : String(error),
      name,
      destination,
    });
    return null;
  }
}
