import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/services/supabase/admin";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import type { CandidatePlace, LatLng } from "@/services/tripBuilder/types";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { loadMatchProfile, computeMatch } from "@/services/tripMatch/matchScore";
import { getTravelDna, type TravelDna } from "@/services/travelDna/travelDnaService";

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
  // *** תיקון: geo היה חובה בשלמותו כדי להעביר includeAllCategories -
  // עכשיו כל השדות אופציונליים בנפרד, כדי ש"הכל" יעבוד גם בחיפוש עיר
  // רגיל (בלי lat/lng), לא רק ב"קרוב אליי".
  opts?: { latitude?: number; longitude?: number; radiusKm?: number; includeAllCategories?: boolean }
): Promise<TripMatchSession> {
  const { data, error } = await supabase
    .from("tripmatch_sessions")
    .insert({
      user_id: userId,
      city,
      category,
      interests,
      latitude: opts?.latitude ?? null,
      longitude: opts?.longitude ?? null,
      radius_km: opts?.radiusKm ?? null,
      include_all_categories: opts?.includeAllCategories ?? false,
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
/** session.category משתמש בטקסונומיית PLACE_CATEGORIES (constants/placeCategories.ts) - tripadd_submissions
 *  משתמשת בטקסונומיה אחרת (HomeQuickCategoryId, constants/homeQuickCategories.ts). ממפים בין השתיים כדי
 *  לסנן נכון. "hotels" -> "sleep" (הכי קרוב מבחינת משמעות; TripMatch עצמו לא מציע "hotels" כאפשרות בחירה
 *  רגילה, אבל session.category יכול לקבל אותו טכנית). אין מקבילה ל-"shopping" בצד PLACE_CATEGORIES - זה
 *  בסדר, כי session רגיל אף פעם לא ישלח אותו; includeAllCategories ממילא מדלג על הסינון הזה. */
const CATEGORY_TO_TRIPADD: Record<string, string> = {
  restaurants: "food",
  nightlife: "nightlife",
  attractions: "attraction",
  nature: "nature",
  hotels: "sleep",
};

function coreCityTerm(city: string): string {
  return city.split(/[-–—]/)[0].trim();
}

/**
 * *** חדש (חיבור "למידת המשתמש" להחלקות - בקשה מפורשת: "למידת המשתמש
 * זה הדבר הכי חשוב!"): עד עכשיו travel_dna עודכן בכל לייק/סקיפ
 * (favoritesService.ts) אבל היה מחובר רק לדירוג יעדים (matchingService)
 * - ההחלקות עצמן (TripMatch, כאן) היו ממוינות רק לפי מרחק/תאריך,
 * בלי שום אישיות. הציון הזה עכשיו קובע את סדר הקלפים: חפיפת קטגוריה
 * רחבה (taxonomy_categories, זהה למרחב הערכים של places.category) +
 * למידה התנהגותית (preferred/disliked_categories, מלייקים/סקיפים
 * קודמים) + החתיכה החזקה ביותר - חפיפה מדויקת ברמת התגית הספציפית
 * (taxonomy_tags מול taxonomy_tags של המקום, שסווג ע"י
 * preferencesTaxonomyClassifier.ts).
 */
function personalizationScore(
  row: { category: string; taxonomyTags: string[]; accessible: boolean | null },
  dna: TravelDna | null
): number {
  if (!dna) return 0;
  let score = 0;
  if (dna.taxonomy_categories.includes(row.category as HomeQuickCategoryId)) score += 2;
  if (dna.preferred_categories.includes(row.category)) score += 2;
  if (dna.disliked_categories.includes(row.category)) score -= 4;
  const tagOverlap = row.taxonomyTags.filter((t) => dna.taxonomy_tags.includes(t)).length;
  score += tagOverlap * 3;
  if (dna.accessibility && row.accessible === true) score += 1;
  return score;
}

/**
 * *** שינוי-מקור (בקשה מפורשת - "שיופיעו רק האטרקציות שהמשתמשים הכניסו לאפליקציה, ולא מה שיש בעמוד admin
 *  places! כולל התגיות, כולל הדירוג של גוגל, כולל המרחק, והתיאור"): TripMatch שולף עכשיו אך ורק מ-
 *  tripadd_submissions (המאגר הקהילתי, ר' migration 0078+) - לא מטבלת places (המאגר שמנוהל ע"י admin/places).
 *  בהתאם, שדות שהיו תלויים בעושר הנתונים של places לא מוצגים: rating/ratingCount = null (לא דירוג גוגל, לא
 *  שום דירוג), tags/tripTypeTags/cuisineTags = [] (בלי תגיות), shortDescription = null (בלי תיאור).
 *  distanceKm עדיין מחושב במצב "קרוב אליי" (המרחק עצמו לא הוסתר בבקשה - רק תגיות/דירוג/תיאור; TripMatchCard
 *  הוא זה שהפסיק להציג את ה-badge של המרחק, ר' שם). תמונות - רק מה שהמשתמשים העלו בפועל
 *  (tripadd_submission_media), לא google_photo_url - אותו עיקרון שכבר קיים ב-tripadd/pins ו-tripAddPlaceService.
 *  בלי סינון לפי status (pending/approved) - אותו עיקרון בדיוק כמו כל שאר המאגר הקהילתי הזה באפליקציה.
 */
async function fetchTripAddCandidates(
  supabase: SupabaseClient,
  session: TripMatchSession,
  limit: number,
  /** *** תוספת (בקשה מפורשת - "מרחק מהמיקום הנוכחי"): המיקום *האמיתי* של המשתמש כרגע - נפרד מ"מוקד
   *  החיפוש" (geoOrigin למטה, שיכול להיות עיר שגואוקדה, לא איפה שהמשתמש נמצא בפועל). כשמועבר, המרחק
   *  המוצג בכרטיס תמיד מחושב ממנו; בלעדיו (המשתמש עוד לא שיתף מיקום) - נופלים חזרה למוקד החיפוש. */
  userLocation?: LatLng | null
): Promise<CandidatePlace[]> {
  const isGeoSearch = session.latitude != null && session.longitude != null;

  // *** תיקון-שורש (בקשה מפורשת - "שמתי רק בתל אביב ואין שום כרטיסייה?! איך זה הגיוני?"): חיפוש-עיר לפי
  // טקסט (tripadd_submissions.city ILIKE) פספס שורות עם city=null (נפוץ כשמוסיפים מקום ע"י נעיצת "+" על
  // המפה - רק lat/lng תמיד נשמרים, ר' tripAddService.ts: `city: input.city ?? null`). עכשיו מגאוקדים את
  // שם העיר שחיפשנו לקואורדינטות, ומסננים לפי מרחק אמיתי - בלי תלות בעמודת city של השורה בכלל.
  let searchOrigin: LatLng | null = isGeoSearch ? { lat: session.latitude!, lng: session.longitude! } : null;
  // *** תוקן (בקשה מפורשת - "טווח של 10 ק''מ, גם במיקום הנוכחי וגם ביעד
  // ספציפי שמזינים"): לפני זה חיפוש-עיר (יעד מוקלד) קיבל רדיוס רחב יותר
  // (20 ק"מ) מ"קרוב אליי" (10 ק"מ) - עכשיו שני המצבים משתמשים באותו
  // רדיוס בדיוק (10 ק"מ), אלא אם המשתמש עצמו ביקש רדיוס אחר (session.radius_km).
  let radiusKm = session.radius_km ?? 10;
  if (!isGeoSearch) {
    const cityCoords = await geocodePlaceName(session.city);
    if (cityCoords) {
      searchOrigin = cityCoords;
      radiusKm = session.radius_km ?? 10;
    }
    // גיאוקוד נכשל (API key חסר/שגיאת רשת) - fail open: ממשיכים בלי סינון גיאוגרפי כלל, במקום 0 תוצאות.
  }
  // מוקד ה*הצגה* של המרחק בכרטיס: המיקום האמיתי של המשתמש כשידוע, אחרת מוקד החיפוש עצמו.
  const distanceOrigin: LatLng | null = userLocation ?? searchOrigin;

  // *** תיקון-שורש (בקשה מפורשת - "למה אין לי תמונה לכל המקומות כאן? לכולן יש תמונה באפליקציה בדקתי"):
  // media_assets נשמרת RLS מוגבל-לבעלים ברמת הטבלה בכוונה ("Owners can view their own media", migration
  // 0067) - חשיפה ציבורית אמורה לעבור תמיד דרך DTO של שרת עם admin client, לא RLS ישיר (בדיוק כמו
  // ב-getTripAddPlaceById ו-pins/route.ts). tripadd_submissions/tripadd_submission_media עצמן כבר
  // ציבוריות לכל משתמש מחובר (migrations 0080/0086) - אבל ה-join המקונן media_assets(url) עדיין רץ עם
  // ה-client הרגיל (מוגבל ל-session/cookies של המבקר), אז השורה חוזרת עם media_assets: null בשקט לכל
  // תמונה שהועלתה ע"י משתמש *אחר* - בדיוק ה"חצי מהמקומות בלי תמונה" שתואר. עמוד המקום הבודד (/place/[id])
  // תמיד הציג נכון כי הוא כבר משתמש ב-admin client. עכשיו גם כאן.
  const adminForMedia = createAdminClient();
  let query = adminForMedia
    .from("tripadd_submissions")
    .select(
      "id, name, category, subcategory, taxonomy_tags, short_description, latitude, longitude, city, price_level, accessible, google_rating, google_rating_count, google_photo_url, google_place_id, tripadd_submission_media(sort_order, media_assets(url))"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (!session.include_all_categories) {
    const tripaddCategory = CATEGORY_TO_TRIPADD[session.category];
    if (tripaddCategory) query = query.eq("category", tripaddCategory);
  }

  if (searchOrigin) {
    const lat = searchOrigin.lat;
    const lng = searchOrigin.lng;
    const latDelta = kmToLatDegrees(radiusKm);
    const lngDelta = kmToLngDegrees(radiusKm, lat);
    query = query
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lng - lngDelta)
      .lte("longitude", lng + lngDelta);
  }

  // אותה עקרון החרגה כמו הגרסה הישנה (14 יום, session + favorites) - ר' שם להסבר המלא.
  const EXCLUSION_TTL_DAYS = 14;
  const exclusionCutoffIso = new Date(Date.now() - EXCLUSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const excluded = new Set([...session.liked_place_ids, ...session.rejected_place_ids]);
  const { data: pastDecisions } = await supabase
    .from("favorites")
    .select("place_id")
    .eq("user_id", session.user_id)
    .gte("created_at", exclusionCutoffIso);
  for (const row of pastDecisions ?? []) excluded.add(row.place_id as string);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit * 3);
  if (error || !data) return [];

  const rows = (data as Array<Record<string, unknown>>).filter((row) => !excluded.has(row.id as string));

  // *** חדש (חיבור למידת המשתמש - ר' personalizationScore למעלה): נטען
  // פעם אחת לכל הבאצ' הזה, לא לכל כרטיס בנפרד.
  const dna = await getTravelDna(supabase, session.user_id);
  const scoreById = new Map<string, number>();
  for (const row of rows) {
    scoreById.set(
      row.id as string,
      personalizationScore(
        {
          category: row.category as string,
          taxonomyTags: (row.taxonomy_tags as string[] | null) ?? [],
          accessible: (row.accessible as boolean | null) ?? null,
        },
        dna
      )
    );
  }

  // *** תוספת (בקשה מפורשת - "דירוג triplace"): ממוצע tripadd_reviews לכל המועמדים בבת-אחת (לא שאילתה
  // נפרדת לכל כרטיס) - אותו עיקרון בדיוק כמו getTripAddPlaceById (עמוד אטרקציה בודד), רק batched.
  const ratingBySubmission = new Map<string, { avg: number; count: number }>();
  if (rows.length > 0) {
    const { data: reviewRows } = await supabase
      .from("tripadd_reviews")
      .select("submission_id, rating")
      .in(
        "submission_id",
        rows.map((r) => r.id as string)
      )
      .not("rating", "is", null);
    const bySubmission = new Map<string, number[]>();
    for (const r of reviewRows ?? []) {
      const list = bySubmission.get(r.submission_id as string) ?? [];
      list.push(r.rating as number);
      bySubmission.set(r.submission_id as string, list);
    }
    for (const [id, ratings] of bySubmission) {
      ratingBySubmission.set(id, { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length });
    }
  }

  const mapped = rows.map((row) => {
    const media = (row.tripadd_submission_media as { sort_order: number; media_assets: { url: string } | null }[] | null)
      ?.filter((m) => m.media_assets?.url)
      .sort((a, b) => a.sort_order - b.sort_order);
    const userPhotos = (media ?? []).map((m) => m.media_assets!.url);
    // *** תוספת (בקשה מפורשת - "איפה כל התמונות?"): כשאין אף תמונה שמשתמש העלה, נופלים חזרה לתמונת ה-
    // Google היחידה שכבר נשמרת מרגע ההגשה עצמה (google_photo_url, autocomplete) - עדיף תמונה אחת אמיתית
    // מאשר כרטיס ריק. תמונות משתמשים תמיד קודמות כשקיימות.
    const imageUrls = userPhotos.length > 0 ? userPhotos : row.google_photo_url ? [row.google_photo_url as string] : [];

    const distanceKm = distanceOrigin
      ? haversineDistanceKm(distanceOrigin, { lat: row.latitude as number, lng: row.longitude as number })
      : 0;

    // *** תוספת (בקשה מפורשת - "קטגוריות... לפחות 3 לכל אטרקציה"): רק עובדות אמיתיות שכבר קיימות בשורה -
    // לא ממציאים תגיות. קטגוריה ראשית + תת-קטגוריה (אם יש) + טווח מחירים/נגישות כשקיימים - בפועל כמעט
    // תמיד 3+ כשהעשרת ה-AI/Google (tripAddEnrichmentService.ts) כבר רצה על השורה.
    const categoryLabel = HOME_QUICK_CATEGORY_LABELS[row.category as HomeQuickCategoryId] ?? (row.category as string);
    const tags = [
      categoryLabel,
      row.subcategory as string | null,
      row.price_level != null ? "₪".repeat(row.price_level as number) : null,
      row.accessible === true ? "♿ נגיש" : null,
    ].filter((t): t is string => !!t);

    const rating = ratingBySubmission.get(row.id as string);

    return {
      id: row.id as string,
      name: row.name as string,
      category: row.category as string,
      subcategory: (row.subcategory as string | null) ?? null,
      shortDescription: (row.short_description as string | null) ?? null,
      imageUrls,
      // "דירוג triplace" - ממוצע הביקורות הקהילתיות (לא Google). null כשעוד אין אף ביקורת.
      rating: rating?.avg ?? null,
      ratingCount: rating?.count ?? null,
      googleRating: (row.google_rating as number | null) ?? null,
      googleRatingCount: (row.google_rating_count as number | null) ?? null,
      priceLevel: (row.price_level as number | null) ?? null,
      estimatedVisitMinutes: null,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      distanceKm,
      etaMinutes: distanceOrigin ? estimateTravelMinutes(distanceKm, "drive") : 0,
      tripTypeTags: [] as string[],
      cuisineTags: [] as string[],
      tags,
      tripmatchScores: {},
      dnaScores: {},
      kosher: null,
      accessible: (row.accessible as boolean | null) ?? null,
      suitableChildAges: [] as string[],
      budgetTier: null,
      isAreaExperience: false,
    };
  });

  // *** איחוד + מקורות קהילתיים (בקשה מפורשת - "יש עוד המון מקומות שלא מופיעים. לא הגיוני שיש
  // ולא מופיע פה"): אותם מקורות כמו מפת place's - לא רק מקומות שהוספו (tripadd), אלא גם מקומות מהמאגר
  // שמשתמשים פרסמו עליהם פוסט או כתבו עליהם ביקורת; כפילויות מאוחדות לכרטיס אחד; ותמונות המשתמשים
  // מהפוסטים/הביקורות נכנסות לכרטיס. ר' mergeCommunityCandidates למטה.
  const combined = await mergeCommunityCandidates({
    supabase,
    admin: adminForMedia,
    session,
    tripadd: mapped,
    googleIdById: new Map(rows.map((r) => [r.id as string, (r.google_place_id as string | null) ?? null])),
    googleFallbackPhotos: new Set(rows.map((r) => r.google_photo_url as string | null).filter((u): u is string => !!u)),
    excluded,
    searchOrigin,
    radiusKm,
    distanceOrigin,
    scoreById,
    dna,
  });

  // *** תיקון: הסינון-לפי-רדיוס חייב להתבסס על מוקד ה*חיפוש* (עיר שנבחרה / "קרוב אליי"), לא על מוקד
  // ה*הצגה* (userLocation) - אחרת חיפוש עיר רחוקה מהמשתמש (או "קרוב אליי" עם מיקום נוכחי אחר) היה מסנן
  // בטעות את כל התוצאות שבאמת בתוך העיר שחיפשו, כי הן "רחוקות מדי" מאיפה שהמשתמש נמצא בפועל. ה-distanceKm
  // שמוצג בכרטיס עדיין מחושב מ-distanceOrigin (userLocation כשידוע) - שני דברים נפרדים בכוונה.
  const searchDistanceKm = (p: { latitude: number; longitude: number }) =>
    searchOrigin ? haversineDistanceKm(searchOrigin, { lat: p.latitude, lng: p.longitude }) : 0;
  const withinRadius = searchOrigin ? combined.filter((p) => searchDistanceKm(p) <= radiusKm) : combined;
  // *** תיקון (חיבור למידת המשתמש - ר' personalizationScore למעלה): המיון
  // הראשי הוא עכשיו לפי ציון האישיות (taxonomy_categories/tags + למידה
  // התנהגותית מ-favorites), לא לפי מרחק גרידא. מרחק נשאר שובר-שוויון,
  // כדי שבין שני מקומות שווי-התאמה עדיין נראה קודם את הקרוב יותר.
  // *** אחוז התאמה אישי לכל כרטיס (בקשה מפורשת - "אחוז התאמה למשתמש לפי ההתאמה האישית"): טעם
  // (העדפות + טקסונומיה), התנהגות (לייקים/דחיות קודמים), איכות, קרבה וצרכים - ר' matchScore.ts.
  const profile = await loadMatchProfile(supabase, session.user_id, dna).catch(() => null);
  const taxonomyById = new Map(rows.map((r) => [r.id as string, (r.taxonomy_tags as string[] | null) ?? []]));
  for (const c of withinRadius) {
    const match = computeMatch(
      {
        category: c.category,
        subcategory: c.subcategory,
        taxonomyTags: taxonomyById.get(c.id) ?? [],
        googleRating: c.googleRating,
        rating: c.rating,
        distanceKm: c.distanceKm,
        accessible: c.accessible,
      },
      profile
    );
    c.matchPercent = match.percent;
    c.matchReasons = match.reasons;
    c.matchPersonalized = match.personalized;
  }
  // המיון הראשי: אחוז ההתאמה (שכבר כולל את ציון ה-DNA), ואחריו ציון האישיות הישן ומרחק כשוברי שוויון.
  const withDistance = [...withinRadius].sort((a, b) => {
    const matchDiff = (b.matchPercent ?? 0) - (a.matchPercent ?? 0);
    if (matchDiff !== 0) return matchDiff;
    const scoreDiff = (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return searchDistanceKm(a) - searchDistanceKm(b);
  });
  return withDistance.slice(0, limit);
}

// ============================================================================
// מקורות קהילתיים + איחוד כפילויות לחפיסת ההחלקות
// ============================================================================

const MERGE_DISTANCE_KM = 0.06;
const IN_CHUNK = 150;

function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'`׳״.,\-–—_()|/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function placeNamesMatch(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 3 && long.includes(short);
}

async function selectInChunks(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: unknown }>
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    try {
      const { data } = await run(ids.slice(i, i + IN_CHUNK));
      if (Array.isArray(data)) out.push(...(data as Record<string, unknown>[]));
    } catch {
      // השלמה בלבד - כשל חלקי לא מפיל את החפיסה.
    }
  }
  return out;
}

type MediaCell = { type?: string | null; url?: string | null; thumbnail_url?: string | null } | null;

function photoOf(m: MediaCell | MediaCell[] | undefined): string | null {
  const cell = Array.isArray(m) ? m[0] : m;
  if (!cell) return null;
  if (cell.type === "video") return cell.thumbnail_url ?? null;
  return cell.url ?? cell.thumbnail_url ?? null;
}

/**
 * מקבל את מועמדי ה-tripadd (כבר ממופים) ומחזיר רשימה משולבת:
 *  1. מאחד כפילויות בין מקומות שהוספו (אותו google_place_id, או עד 60 מ' ושם תואם) - כרטיס אחד,
 *     עם כל התמונות של כל ההעלאות.
 *  2. מוסיף לכל כרטיס את התמונות מפוסטים שמשתמשים פרסמו על המקום.
 *  3. מוסיף מקומות מהמאגר (places) שמשתמשים פרסמו עליהם פוסט או כתבו ביקורת - באותו רדיוס וקטגוריה.
 *     מקום כזה שהוא כפילות של מקום שהוסף - לא נוסף שוב; רק התמונות שלו מצטרפות לכרטיס הקיים.
 * הפוסטים נשלפים עם הלקוח הרגיל (RLS - אותה נראות כמו בפיד); מדיה עם admin (כמו בפיד ובמפה).
 */
async function mergeCommunityCandidates(args: {
  supabase: SupabaseClient;
  admin: ReturnType<typeof createAdminClient>;
  session: TripMatchSession;
  tripadd: CandidatePlace[];
  googleIdById: Map<string, string | null>;
  /** תמונות Google שהוצגו רק כי לא היו תמונות משתמשים - יורדות ברגע שיש תמונת משתמש. */
  googleFallbackPhotos: Set<string>;
  excluded: Set<string>;
  searchOrigin: LatLng | null;
  radiusKm: number;
  distanceOrigin: LatLng | null;
  scoreById: Map<string, number>;
  dna: TravelDna | null;
}): Promise<CandidatePlace[]> {
  const { supabase, admin, session, googleIdById, excluded, searchOrigin, radiusKm, distanceOrigin, scoreById, dna } = args;

  /** מוסיף תמונות משתמשים; תמונת Google (fallback) יורדת ברגע שיש תמונת משתמש אמיתית. */
  const addPhotosFront = (target: CandidatePlace, photos: string[]) => {
    const fresh = photos.filter((u) => !target.imageUrls.includes(u));
    if (!fresh.length) return;
    const userOnly = target.imageUrls.filter((u) => !args.googleFallbackPhotos.has(u));
    target.imageUrls = [...userOnly, ...fresh];
  };

  // ---------- 1. איחוד כפילויות בין מקומות שהוספו ----------
  const merged: CandidatePlace[] = [];
  const repOf = new Map<string, CandidatePlace>();
  const googleOfRep = new Map<CandidatePlace, string | null>();
  for (const c of args.tripadd) {
    const g = googleIdById.get(c.id) ?? null;
    const dup = merged.find((d) => {
      const dg = googleOfRep.get(d) ?? null;
      if (g && dg) return g === dg;
      return (
        haversineDistanceKm({ lat: d.latitude, lng: d.longitude }, { lat: c.latitude, lng: c.longitude }) <= MERGE_DISTANCE_KM &&
        placeNamesMatch(d.name, c.name)
      );
    });
    if (dup) {
      const userPhotos = c.imageUrls.filter((u) => !args.googleFallbackPhotos.has(u));
      if (userPhotos.length) addPhotosFront(dup, userPhotos);
      if (!googleOfRep.get(dup) && g) googleOfRep.set(dup, g);
      repOf.set(c.id, dup);
      continue;
    }
    const copy: CandidatePlace = { ...c, imageUrls: [...c.imageUrls] };
    merged.push(copy);
    googleOfRep.set(copy, g);
    repOf.set(c.id, copy);
  }


  // ---------- 2. תמונות מפוסטים על מקומות שהוספו ----------
  const tripaddIds = [...repOf.keys()];
  const tripaddPosts = await selectInChunks(tripaddIds, (chunk) =>
    supabase.from("posts").select("id, tripadd_submission_id").is("deleted_at", null).in("tripadd_submission_id", chunk)
  );

  // ---------- 3. מקומות מהמאגר שמשתמשים פרסמו/דירגו עליהם ----------
  const [placePostsRes, placeReviewsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, place_id")
      .is("deleted_at", null)
      .not("place_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase.from("place_reviews").select("id, place_id, rating").limit(2000),
  ]);
  const placePosts = (placePostsRes.data ?? []) as Record<string, unknown>[];
  const placeReviews = (placeReviewsRes.data ?? []) as Record<string, unknown>[];
  const communityPlaceIds = [
    ...new Set([...placePosts.map((p) => p.place_id as string), ...placeReviews.map((r) => r.place_id as string)].filter(Boolean)),
  ].filter((id) => !excluded.has(id));

  let placeRows = await selectInChunks(communityPlaceIds, (chunk) => {
    let q = supabase
      .from("places")
      .select("id, name, category, subcategory, short_description, latitude, longitude, city, rating, rating_count, price_level, image_urls, google_place_id, accessible, kosher")
      .in("id", chunk)
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    if (!session.include_all_categories) q = q.eq("category", session.category);
    if (searchOrigin) {
      const latDelta = kmToLatDegrees(radiusKm);
      const lngDelta = kmToLngDegrees(radiusKm, searchOrigin.lat);
      q = q
        .gte("latitude", searchOrigin.lat - latDelta)
        .lte("latitude", searchOrigin.lat + latDelta)
        .gte("longitude", searchOrigin.lng - lngDelta)
        .lte("longitude", searchOrigin.lng + lngDelta);
    }
    return q;
  });
  placeRows = placeRows.filter((r) => !excluded.has(r.id as string));

  // ---------- מדיה (admin) לכל הפוסטים/ביקורות הרלוונטיים ----------
  const placeIdSet = new Set(placeRows.map((r) => r.id as string));
  const relevantPlacePosts = placePosts.filter((p) => placeIdSet.has(p.place_id as string));
  const relevantReviews = placeReviews.filter((r) => placeIdSet.has(r.place_id as string));
  const allPostIds = [...tripaddPosts.map((p) => p.id as string), ...relevantPlacePosts.map((p) => p.id as string)];
  const [postMedia, reviewMedia] = await Promise.all([
    selectInChunks(allPostIds, (chunk) =>
      admin.from("post_media").select("post_id, sort_order, media:media_assets(type, url, thumbnail_url)").in("post_id", chunk).order("sort_order", { ascending: true })
    ),
    selectInChunks(
      relevantReviews.map((r) => r.id as string),
      (chunk) =>
        admin.from("review_media").select("review_id, sort_order, media:media_assets(type, url, thumbnail_url)").in("review_id", chunk).order("sort_order", { ascending: true })
    ),
  ]);
  const photosByPost = new Map<string, string[]>();
  for (const m of postMedia) {
    const url = photoOf(m.media as MediaCell);
    if (!url) continue;
    const list = photosByPost.get(m.post_id as string) ?? [];
    if (!list.includes(url)) list.push(url);
    photosByPost.set(m.post_id as string, list);
  }
  const photosByReview = new Map<string, string[]>();
  for (const m of reviewMedia) {
    const url = photoOf(m.media as MediaCell);
    if (!url) continue;
    const list = photosByReview.get(m.review_id as string) ?? [];
    if (!list.includes(url)) list.push(url);
    photosByReview.set(m.review_id as string, list);
  }

  // תמונות פוסטים -> כרטיסי tripadd
  for (const p of tripaddPosts) {
    const target = repOf.get(p.tripadd_submission_id as string);
    if (target) addPhotosFront(target, photosByPost.get(p.id as string) ?? []);
  }

  // מקומות מהמאגר -> כרטיס חדש, או מיזוג לכרטיס קיים אם זו כפילות
  const ratingsByPlace = new Map<string, number[]>();
  for (const r of relevantReviews) {
    if (r.rating == null) continue;
    const list = ratingsByPlace.get(r.place_id as string) ?? [];
    list.push(r.rating as number);
    ratingsByPlace.set(r.place_id as string, list);
  }

  for (const row of placeRows) {
    const id = row.id as string;
    const lat = row.latitude as number;
    const lng = row.longitude as number;
    const name = row.name as string;
    const google = (row.google_place_id as string | null) ?? null;
    const userPhotos: string[] = [];
    for (const p of relevantPlacePosts) if (p.place_id === id) for (const u of photosByPost.get(p.id as string) ?? []) if (!userPhotos.includes(u)) userPhotos.push(u);
    for (const r of relevantReviews) if (r.place_id === id) for (const u of photosByReview.get(r.id as string) ?? []) if (!userPhotos.includes(u)) userPhotos.push(u);

    const dup = merged.find((d) => {
      const dg = googleOfRep.get(d) ?? null;
      if (google && dg) return google === dg;
      return haversineDistanceKm({ lat: d.latitude, lng: d.longitude }, { lat, lng }) <= MERGE_DISTANCE_KM && placeNamesMatch(d.name, name);
    });
    if (dup) {
      addPhotosFront(dup, userPhotos);
      continue;
    }

    const imageUrls = userPhotos.length ? userPhotos : ((row.image_urls as string[] | null) ?? []).slice(0, 1);
    const category = CATEGORY_TO_TRIPADD[row.category as string] ?? (row.category as string);
    const categoryLabel = HOME_QUICK_CATEGORY_LABELS[category as HomeQuickCategoryId] ?? getCategoryLabel(row.category as string);
    const ratings = ratingsByPlace.get(id) ?? [];
    const distanceKm = distanceOrigin ? haversineDistanceKm(distanceOrigin, { lat, lng }) : 0;
    const accessible = (row.accessible as boolean | null) ?? null;

    const candidate: CandidatePlace = {
      id,
      name,
      category,
      subcategory: (row.subcategory as string | null) ?? null,
      shortDescription: (row.short_description as string | null) ?? null,
      imageUrls,
      rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      ratingCount: ratings.length || null,
      googleRating: row.rating != null ? Number(row.rating) : null,
      googleRatingCount: (row.rating_count as number | null) ?? null,
      priceLevel: (row.price_level as number | null) ?? null,
      estimatedVisitMinutes: null,
      latitude: lat,
      longitude: lng,
      distanceKm,
      etaMinutes: distanceOrigin ? estimateTravelMinutes(distanceKm, "drive") : 0,
      tripTypeTags: [],
      cuisineTags: [],
      tags: [
        categoryLabel,
        (row.subcategory as string | null) ?? null,
        row.price_level != null ? "₪".repeat(row.price_level as number) : null,
        accessible === true ? "♿ נגיש" : null,
      ].filter((t): t is string => !!t),
      tripmatchScores: {},
      dnaScores: {},
      kosher: (row.kosher as boolean | null) ?? null,
      accessible,
      suitableChildAges: [],
      budgetTier: null,
      isAreaExperience: false,
    } as CandidatePlace;
    merged.push(candidate);
    googleOfRep.set(candidate, google);
    scoreById.set(id, personalizationScore({ category, taxonomyTags: [], accessible }, dna));
  }

  return merged;
}

export async function fetchTripMatchCandidates(
  supabase: SupabaseClient,
  session: TripMatchSession,
  // *** תוקן (בקשה מפורשת - "לא תהיה הגבלה של 10 אטרקציות") + תוקן שוב
  // (Bug מפורש - "אין כלום בכלל!"): 300 (השאילתה הגולמית .limit(limit*3)
  // = 900 שורות + JOIN על תמונות) היה כבד/איטי מדי, וכשה-fetch הראשוני
  // נכשל/timeout־ת, ה-stage כלל לא מתקדם ל-"swiping" - אז אפילו כרטיס
  // ה"הוספת מקום" (שרק מוצג *בתוך* מסך ה-swiping) לא מופיע, והעמוד
  // נשאר ריק לגמרי. 150 (450 שורות גולמיות) הרבה יותר ממה שרדיוס 10
  // ק"מ אמיתי מחזיר כמעט תמיד, אבל קל משמעותית מ-300.
  limit = 150,
  userLocation?: LatLng | null
): Promise<CandidatePlace[]> {
  // *** שינוי-מקור (ר' ההערה המלאה מעל fetchTripAddCandidates): המקור היחיד עכשיו הוא tripadd_submissions.
  return fetchTripAddCandidates(supabase, session, limit, userLocation);
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
  // *** תיקון-שורש (בקשה מפורשת - "אותה כרטיסייה חוזרת... תיצור פלואו
  // מושלם"): קודם זה היה read-then-write לא אטומי (קורא את הסשן,
  // מוסיף placeId למערך בזיכרון, כותב הכל בחזרה) - swipe מהיר/רצוף
  // על אותו session יכול לגרום לקריאה השנייה לדרוס את התוצאה של
  // הראשונה לפני שהיא נכתבה, וה-place ה"מוחלט" חוזר להופיע כמועמד.
  // עכשיו append אטומי בתוך ה-DB עצמו (ר' migration 0088) - אין יותר
  // חלון מרוץ בין קריאה לכתיבה.
  const { error } = await supabase.rpc("tripmatch_record_decision", {
    p_session_id: sessionId,
    p_place_id: placeId,
    p_liked: liked,
  });
  if (error) {
    console.error("[tripMatchService] recordTripMatchDecision RPC נכשל:", error);
  }
}
