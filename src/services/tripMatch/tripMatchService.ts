import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import type { CandidatePlace, LatLng } from "@/services/tripBuilder/types";

export interface TripMatchSession {
  id: string;
  user_id: string;
  city: string;
  category: string;
  interests: string[];
  liked_place_ids: string[];
  rejected_place_ids: string[];
  /** מצב "קרוב אליי" - כשמוגדרים, fetchTripMatchCandidates מחפש ברדיוס
   *  אמיתי מהקואורדינטות (לא לפי התאמת שם עיר). null/undefined = חיפוש
   *  רגיל לפי עיר, כמו קודם. */
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  /** "קרוב אליי" עם בחירת "הכל" - מדלגים על סינון הקטגוריה (רק מוציאים
   *  "מלונות"), כדי להראות מסעדות/חיי לילה/טבע/אטרקציות יחד ברדיוס. */
  include_all_categories?: boolean;
}

export async function createTripMatchSession(
  supabase: SupabaseClient,
  userId: string,
  city: string,
  category: string,
  interests: string[],
  geo?: { latitude: number; longitude: number; radiusKm: number; includeAllCategories?: boolean }
): Promise<TripMatchSession> {
  const { data, error } = await supabase
    .from("tripmatch_sessions")
    .insert({
      user_id: userId,
      city,
      category,
      interests,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      radius_km: geo?.radiusKm ?? null,
      include_all_categories: geo?.includeAllCategories ?? false,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "יצירת ה-session נכשלה");
  return data as TripMatchSession;
}

export async function getTripMatchSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<TripMatchSession | null> {
  const { data } = await supabase.from("tripmatch_sessions").select("*").eq("id", sessionId).maybeSingle();
  return data as TripMatchSession | null;
}

/** קירוב מעלות ק"ו/קו-רוחב לפי ק"מ, לשימוש בתיבת-חסימה (bounding box)
 *  שמצמצמת את השאילתה ל-DB לפני הסינון המדויק (haversine) ב-JS. */
function kmToLatDegrees(km: number): number {
  return km / 111;
}
function kmToLngDegrees(km: number, atLat: number): number {
  const cos = Math.max(0.1, Math.cos((atLat * Math.PI) / 180));
  return km / (111 * cos);
}

/** "תל אביב-יפו" -> "תל אביב". ה-destinations table (ומכאן גם הערים
 *  שמוצעות בהשלמה האוטומטית של שדה היעד) שומר לפעמים את השם הרשמי/הכפול
 *  של ערי תאומות ("עיר-עיר"), בעוד שב-places.city נשמר לרוב רק החלק
 *  הראשי - כך ש-ILIKE של השם המלא לא מוצא את השורות (המחרוזת הקצרה יותר
 *  לא *מכילה* את הארוכה). לוקחים את החלק שלפני המקף כדי שההתאמה תעבוד
 *  משני הכיוונים. */
function coreCityTerm(city: string): string {
  return city.split(/[-–—]/)[0].trim();
}

/** שולף מועמדים (אטרקציות) - בשני מצבים אפשריים:
 *  1. חיפוש רגיל לפי עיר/מדינה שנבחרה בשלב 2.
 *  2. "קרוב אליי" (session.latitude/longitude מוגדרים) - חיפוש רדיוס
 *     אמיתי מהקואורדינטות, בלי קשר לשם העיר בכלל (כי מקום קרוב יכול
 *     להיות רשום תחת עיר שכנה - "רמת גן" למשל, שנמצאת ממש ליד תל אביב
 *     אבל לא תואמת ILIKE של השם "תל אביב"). */
export async function fetchTripMatchCandidates(
  supabase: SupabaseClient,
  session: TripMatchSession,
  limit = 60
): Promise<CandidatePlace[]> {
  const isGeoSearch = session.latitude != null && session.longitude != null;

  let query = supabase
    .from("places")
    .select(
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,tags,tripmatch_scores,dna_scores,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience,city"
    )
    // *** תיקון: TripMatch היה שולף מכל 2717 השורות בטבלה, כולל כל
    // מה שמסומן is_legacy=true (מקומות "בארכיון" שהאדמין בכוונה לא
    // רוצה שיוצגו יותר). וגם היה מחזיר מקומות מכל קטגוריה (מסעדות,
    // מלונות, חיי לילה וכו') ולא רק אטרקציות. שני הפילטרים האלה חסרים
    // מקוריים - זה לא שינוי בהתנהגות אלא סגירת פער אמיתי.
    .eq("is_legacy", false);

  // *** תיקון: לפני זה היה .eq("category", "attractions") קבוע - עכשיו
  // תלוי בקטגוריה שהמשתמש בחר בשלב 2 (מסעדות/חיי לילה/טבע/אטרקציות),
  // כדי שבחירת "מסעדות וקולינריה" באמת תחזיר מסעדות ולא אטרקציות.
  // *** ב"קרוב אליי" עם "הכל" (include_all_categories) לא מסננים לפי
  // קטגוריה בכלל - כדי שמקומות שהוזנו ידנית באדמין תחת כל קטגוריה
  // (מסעדה, חיי לילה, טבע וכו') יופיעו אם הם קרובים, ולא רק אטרקציות.
  // אם המשתמש בחר קטגוריה ספציפית ב"קרוב אליי" - עדיין מסננים רגיל.
  if (session.include_all_categories) {
    query = query.neq("category", "hotels");
  } else {
    query = query.eq("category", session.category);
  }

  if (isGeoSearch) {
    // "קרוב אליי" - תיבת-חסימה גסה סביב הקואורדינטות (מצמצמת את מה
    // שנשלף מה-DB), והסינון המדויק לרדיוס בק"מ קורה אחר כך ב-JS.
    const lat = session.latitude!;
    const lng = session.longitude!;
    const radiusKm = session.radius_km ?? 10;
    const latDelta = kmToLatDegrees(radiusKm);
    const lngDelta = kmToLngDegrees(radiusKm, lat);
    query = query
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lng - lngDelta)
      .lte("longitude", lng + lngDelta);
  } else {
    // *** תיקון: "תל אביב-יפו" (שם רשמי, כפי שנשמר ב-destinations ומוצג
    // בהשלמה האוטומטית של שדה היעד) לא תאם ל-ILIKE כש-places.city שמור
    // בתור "תל אביב" בלבד - ה-ILIKE בודק אם *העמודה* מכילה את המחרוזת
    // שחיפשנו, ו"תל אביב" לא מכילה את "תל אביב-יפו". לוקחים את החלק
    // העיקרי (לפני מקף) כדי שההתאמה תעבוד גם כשה-DB שמור בגרסה הקצרה.
    const cityTerm = coreCityTerm(session.city);
    query = query.or(`city.ilike.%${cityTerm}%,country.ilike.%${session.city}%`);
  }

  if (session.interests.length > 0) {
    // *** תיקון: הפילטר בדק overlap רק מול trip_type_tags (הטקסונומיה
    // הישנה) - מקומות שהוזנו/תויגו ידנית באדמין (כפתור "✨ תקן עם AI",
    // או הזנה ישירה) שומרים את הסיווג שלהם בשדה tags (ולפעמים
    // cuisine_tags), שלא נבדק בכלל בשאילתה הזו - לכן "אחר" עם תגית כמו
    // "תרבות, מוזיאונים והיסטוריה" לא מצא מקומות שבפועל קיימים ומתויגים,
    // רק כי הם לא תויגו בטקסונומיה הישנה הספציפית. עכשיו בודקים חפיפה
    // מול שלושת השדות (OR), בדיוק כמו שכבר נעשה בצד הלקוח (אחוז ההתאמה
    // והפילטרים במסך ההחלקות כבר משתמשים בכל השדות יחד).
    const tagList = session.interests.join(",");
    query = query.or(`trip_type_tags.ov.{${tagList}},cuisine_tags.ov.{${tagList}},tags.ov.{${tagList}}`);
  }

  // *** תיקון: לפני זה החרגה כללה רק liked_place_ids/rejected_place_ids
  // של ה-session **הנוכחי** - session חדש (למשל בפעם הבאה שפותחים
  // TripMatch לאותה עיר) מתחיל עם מערכים ריקים, כך שמקומות שכבר
  // הוחלקו (בכל כיוון) בעבר חוזרים ומופיעים שוב. עכשיו מחריגים גם כל
  // מקום שכבר קיים ב-favorites של המשתמש (liked/saved/skipped).
  // *** תיקון נוסף: ההחרגה הייתה לצמיתות - מקום שהוחלט עליו פעם נעלם
  // מהתוצאות לתמיד, גם כעבור חודשים. עכשיו ההחרגה מוגבלת בזמן (14 יום) -
  // אחרי שבועיים המקום חוזר להופיע (למשל אם הטעם השתנה, או פשוט רוצים
  // לראות שוב אופציות שכבר "נסגרו"). זה חל רק על ההחרגה המצטברת מ-
  // favorites - שני המערכים של ה-session הנוכחי עצמו תמיד מוחרגים,
  // בלי קשר לזמן (לא הגיוני לראות שוב באותו סבב סריקה מקום שכרגע החלטת עליו).
  const EXCLUSION_TTL_DAYS = 14;
  const exclusionCutoffIso = new Date(Date.now() - EXCLUSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const excluded = new Set([...session.liked_place_ids, ...session.rejected_place_ids]);
  const { data: pastDecisions } = await supabase
    .from("favorites")
    .select("place_id")
    .eq("user_id", session.user_id)
    .eq("place_type", "place")
    .gte("created_at", exclusionCutoffIso);
  for (const row of pastDecisions ?? []) excluded.add(row.place_id as string);

  if (excluded.size > 0) {
    query = query.not("id", "in", `(${Array.from(excluded).join(",")})`);
  }

  const { data, error } = await query.limit(isGeoSearch ? limit * 3 : limit);
  if (error || !data) return [];

  const geoOrigin: LatLng | null = isGeoSearch ? { lat: session.latitude!, lng: session.longitude! } : null;
  const radiusKm = session.radius_km ?? 10;

  const mapped = data
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => {
      const distanceKm = geoOrigin ? haversineDistanceKm(geoOrigin, { lat: row.latitude!, lng: row.longitude! }) : 0;
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
        etaMinutes: geoOrigin ? estimateTravelMinutes(distanceKm, "drive") : 0,
        tripTypeTags: row.trip_type_tags ?? [],
        cuisineTags: row.cuisine_tags ?? [],
        // *** תיקון: לפני זה השדות tags/tripmatch_scores/dna_scores שהאדמין
        // ממלא (כפתור "✨ תקן עם AI" ב-/admin/places) בכלל לא הגיעו ל-TripMatch -
        // רק trip_type_tags/cuisine_tags הישנים היו בשימוש. זו הסיבה שהפילטרים
        // לא הראו כלום למקומות שהאדמין תייג ידנית עם ה-AI, ושאחוז ההתאמה
        // התעלם לגמרי מהתאמות שנקבעו באדמין.
        tags: row.tags ?? [],
        tripmatchScores: row.tripmatch_scores ?? {},
        dnaScores: row.dna_scores ?? {},
        kosher: row.kosher,
        accessible: row.accessible,
        suitableChildAges: row.suitable_child_ages ?? [],
        budgetTier: row.budget_tier,
        isAreaExperience: row.is_area_experience ?? false,
        // שדה עזר פנימי לאימות המיקום למטה - לא חלק מ-CandidatePlace,
        // מוסר לפני ההחזרה הסופית.
        _city: row.city as string | null | undefined,
      };
    });

  if (!geoOrigin) return mapped.map(stripInternalFields);

  // תיבת-החסימה למעלה גסה (מלבן, לא עיגול) - כאן הסינון המדויק לרדיוס
  // האמיתי בק"מ (Haversine), וממיינים מהקרוב לרחוק. מריצים את זה *לפני*
  // אימות המיקום למטה, כדי שהקריאות ל-Geocoding API (היקרות) ירוצו רק
  // על הרשימה הקטנה שכבר בטווח, לא על כל מה שהוחזר מהתיבה הגסה.
  const withinRadius = mapped.filter((p) => p.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);

  const verified = await verifyPlaceCities(supabase, withinRadius);
  return verified.slice(0, limit).map(stripInternalFields);
}

/** מסיר את שדה העזר הפנימי (_city) לפני ההחזרה ללקוח - לא חלק מ-CandidatePlace,
 *  משמש רק לאימות המיקום בתוך הקובץ הזה. */
function stripInternalFields<T extends { _city?: unknown }>(p: T): Omit<T, "_city"> {
  const { _city, ...rest } = p;
  return rest;
}

/** מאמת שה-city שרשום לכל מקום תואם בפועל למיקום הגיאוגרפי שלו - כדי
 *  לתפוס מקרים של טעות הזנת נתונים (כמו "מטולה" עם קואורדינטות שנמצאות
 *  בפועל ברמת גן) שאחרת "יעברו" את בדיקת הרדיוס בטעות, כי הרדיוס עצמו
 *  עובד נכון על הקואורדינטות השגויות שנשמרו.
 *
 *  *** תיקון: הגרסה הקודמת השוותה שמות ערים כמחרוזות (reverse geocoding
 *  + coreCityTerm containment) - זה היה שביר מדי: עיירה גובלת, שכונה,
 *  או ניסוח מעט שונה גרמו לפסילת מקומות שבאמת קרובים ותקינים, גם כשאין
 *  שום טעות נתונים. עכשיו הבדיקה היא לפי **מרחק אמיתי בק"מ** (כמו שכבר
 *  עובד בטבלת ה-destinations) - מגייאוקדים (forward geocoding) את שם
 *  העיר שהמקום *עצמו* טוען שהוא נמצא בה, ובודקים כמה רחוקות הקואורדינטות
 *  שלו מהמרכז של העיר הזו. זה גם יותר סלחני (לא נכשל על הבדלי ניסוח)
 *  וגם יותר מדויק (משווה מרחק אמיתי, לא טקסט).
 *
 *  שתי שכבות, לפי סדר עלות:
 *  1. destinations table (221 היעדים המתוירים) - מהיר וחינמי.
 *  2. city_geocode_cache - קאש של geocoding חי לערים שלא ברשימה
 *     המתוירת (כמו מטולה) - ברמת עיר, לא ברמת מקום, כדי שכל המקומות
 *     שרשומים תחת אותה עיר ישתפו קריאת API אחת. */
async function verifyPlaceCities<T extends { id: string; latitude: number; longitude: number; _city?: string | null }>(
  supabase: SupabaseClient,
  candidates: T[]
): Promise<T[]> {
  // סלחני יחסית בכוונה - המטרה לתפוס רק טעויות נתונים בוטות (עיר אחרת
  // לגמרי, מרחק של עשרות/מאות ק"מ), לא לפסול מקומות אמיתיים שקרובים
  // בגלל אזור מטרופולין גדול או ניסוח גבול-שכונה.
  const MAX_CITY_COORD_MISMATCH_KM = 60;

  const withCity = candidates.filter((c) => !!c._city);
  if (withCity.length === 0) return candidates;

  const cityNames = Array.from(new Set(withCity.map((c) => c._city!)));
  const searchTerms = Array.from(new Set(cityNames.flatMap((c) => [c, coreCityTerm(c)])));

  const cityCoords = new Map<string, LatLng>();

  // שכבה 1: destinations table.
  const { data: destinationRows } = await supabase.from("destinations").select("name, latitude, longitude").in("name", searchTerms);
  for (const d of destinationRows ?? []) {
    if (d.latitude != null && d.longitude != null) {
      const coords = { lat: d.latitude as number, lng: d.longitude as number };
      cityCoords.set(d.name as string, coords);
      cityCoords.set(coreCityTerm(d.name as string), coords);
    }
  }

  // שכבה 2: קאש geocoding קודם.
  const stillUnresolved = cityNames.filter((name) => !cityCoords.has(name) && !cityCoords.has(coreCityTerm(name)));
  if (stillUnresolved.length > 0) {
    const { data: cacheRows } = await supabase.from("city_geocode_cache").select("city_name, latitude, longitude").in("city_name", stillUnresolved);
    for (const c of cacheRows ?? []) {
      cityCoords.set(c.city_name as string, { lat: c.latitude as number, lng: c.longitude as number });
    }
  }

  // שכבה 3: geocoding חי (רק לערים שעדיין לא נפתרו - ברמת עיר, לא מקום).
  const needsLiveGeocode = cityNames.filter((name) => !cityCoords.has(name) && !cityCoords.has(coreCityTerm(name)));
  if (needsLiveGeocode.length > 0) {
    await Promise.all(
      needsLiveGeocode.map(async (cityName) => {
        const coords = await geocodePlaceName(cityName);
        if (coords) {
          cityCoords.set(cityName, coords);
          // קאש ל-DB - "ירה ושכח", לא חוסם את הבקשה הנוכחית אם נכשל
          // (כולל אם השורה כבר קיימת - ignoreDuplicates פשוט מדלג).
          supabase
            .from("city_geocode_cache")
            .upsert({ city_name: cityName, latitude: coords.lat, longitude: coords.lng }, { onConflict: "city_name", ignoreDuplicates: true })
            .then(() => {});
        }
      })
    );
  }

  return candidates.filter((c) => {
    if (!c._city) return true; // אין city בכלל - אין מול מה לאמת, לא פוסלים
    const expected = cityCoords.get(c._city) ?? cityCoords.get(coreCityTerm(c._city));
    if (!expected) return true; // לא הצלחנו לגאוקד בכלל - לא חוסמים (fail open)
    const mismatchKm = haversineDistanceKm(expected, { lat: c.latitude, lng: c.longitude });
    return mismatchKm <= MAX_CITY_COORD_MISMATCH_KM;
  });
}

export async function recordTripMatchDecision(
  supabase: SupabaseClient,
  sessionId: string,
  placeId: string,
  liked: boolean
): Promise<void> {
  const session = await getTripMatchSession(supabase, sessionId);
  if (!session) return;

  const field = liked ? "liked_place_ids" : "rejected_place_ids";
  const current = liked ? session.liked_place_ids : session.rejected_place_ids;
  if (current.includes(placeId)) return;

  await supabase
    .from("tripmatch_sessions")
    .update({ [field]: [...current, placeId] })
    .eq("id", sessionId);
}
