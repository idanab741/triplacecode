import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "./geocodingService";
import { findPlacePhotoReference } from "./placePhotoService";
import { haversineDistanceKm, kmToDegreesLat, kmToDegreesLng } from "./geo";
import type { LatLng } from "./types";

export interface CentralNeighborhoodInfo {
  /** שם השכונה/מרכז העיר (למשל "פלאקה", "בורן", "מונמארטר") */
  name: string;
  coords: LatLng;
  imageUrl: string | null;
}

interface FindCentralNeighborhoodParams {
  destination: string;
  /** מרכז היעד + רדיוס חיפוש - לחיפוש במאגר שלנו קודם כל. */
  origin: LatLng;
  radiusKm: number;
}

export async function findCentralNeighborhood(
  supabase: SupabaseClient,
  params: FindCentralNeighborhoodParams
): Promise<CentralNeighborhoodInfo | null> {
  const { data: cached } = await supabase
    .from("destination_neighborhood_cache")
    .select("name,latitude,longitude,image_url")
    .eq("destination", params.destination)
    .maybeSingle();

  if (cached) {
    return { name: cached.name, coords: { lat: cached.latitude, lng: cached.longitude }, imageUrl: cached.image_url };
  }

  const fresh = await computeCentralNeighborhood(supabase, params);
  if (fresh) {
    // שמירה במטמון לא-חוסמת - לא רוצים לעכב את התשובה בשביל ה-insert.
    supabase
      .from("destination_neighborhood_cache")
      .insert({
        destination: params.destination,
        name: fresh.name,
        latitude: fresh.coords.lat,
        longitude: fresh.coords.lng,
        image_url: fresh.imageUrl,
      })
      .then(({ error }) => {
        if (error) logAiError("שמירת השכונה המרכזית במטמון נכשלה (לא חוסם)", { destination: params.destination, message: error.message });
      });
  }
  return fresh;
}

/**
 * מאתר את "השכונה המרכזית" של יעד חופשה בחו"ל - לכרטיס יום 1 (ר'
 * injectLogisticsStops) ולעיגון רדיוס חיפוש מסעדת יום 1.
 *
 * בקשה מפורשת ("אין שום מושג שכונה - בשביל זה יש את השילוב של קלוד עם
 * ADMIN PLACES, זה התפקיד שלו"): אין ישות "שכונה" נפרדת במאגר - אז לא
 * שולפים סתם את המקום המדורג הכי גבוה ומשתמשים בשם העסק שלו כאילו הוא
 * שם שכונה (זו הייתה בדיוק הבעיה - "שטרופי", מסעדה, הוצג כ"שכונה").
 * במקום זה: שולפים כמה מקומות אמיתיים ומדורגים גבוה מהמאגר שלנו קרוב
 * למרכז היעד, ו-Claude (עם הידע הכללי שלו על גיאוגרפיה) מזהה את שם
 * השכונה/האזור שהם נמצאים בו בפועל - ובוחר **אחד מהם, בדיוק כפי שנמסר,
 * לא מומצא** בתור נקודת העוגן (לקואורדינטות אמיתיות מהמאגר שלנו, לא
 * מ-Google). כך גם השם מבוסס-ידע וגם המיקום מאומת מהמאגר.
 *
 * בקשה מפורשת נוספת ("למה התמונה משתנה כל פעם?! חבל על הטוקנים
 * מגוגל!"): הפונקציה הזו לא דטרמיניסטית לגמרי (Claude) - נקראת דרך
 * findCentralNeighborhood למעלה, שעוטפת אותה במטמון קבוע לפי יעד. זה מה
 * שמבטיח תוצאה אחידה בכל פעם, לא רק חוסך קריאות.
 */
async function computeCentralNeighborhood(
  supabase: SupabaseClient,
  params: FindCentralNeighborhoodParams
): Promise<CentralNeighborhoodInfo | null> {
  const candidates = await fetchNeighborhoodCandidates(supabase, params.origin, params.radiusKm);
  if (candidates.length === 0) {
    logAiError("אין שום מקום מהמאגר שלנו קרוב ליעד - נופלים לגיבוי גוגל/Claude", {
      destination: params.destination,
    });
    return findViaGoogleFallback(params.destination);
  }

  const identified = await identifyNeighborhoodFromCandidates(params.destination, candidates);
  if (identified) return identified;

  // Claude נכשל/לא זיהה - במקום לוותר, פשוט לוקחים את המועמד המדורג
  // הכי גבוה (עדיין מהמאגר שלנו, רק בלי שם-שכונה "אמיתי" - בשם המקום עצמו).
  const top = candidates[0];
  return { name: top.name, coords: { lat: top.latitude, lng: top.longitude }, imageUrl: top.image_urls?.[0] ?? null };
}

interface NeighborhoodCandidateRow {
  name: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  image_urls: string[] | null;
}

async function fetchNeighborhoodCandidates(
  supabase: SupabaseClient,
  origin: LatLng,
  radiusKm: number
): Promise<NeighborhoodCandidateRow[]> {
  const latDelta = kmToDegreesLat(radiusKm);
  const lngDelta = kmToDegreesLng(radiusKm, origin.lat);

  const { data, error } = await supabase
    .from("places")
    .select("name,latitude,longitude,rating,image_urls")
    .eq("is_legacy", false)
    .neq("category", "nightlife")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", origin.lat - latDelta)
    .lte("latitude", origin.lat + latDelta)
    .gte("longitude", origin.lng - lngDelta)
    .lte("longitude", origin.lng + lngDelta)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error || !data) return [];

  return (data as NeighborhoodCandidateRow[]).filter(
    (r) => haversineDistanceKm(origin, { lat: r.latitude, lng: r.longitude }) <= radiusKm
  );
}

/**
 * נותנת ל-Claude רשימת מקומות אמיתיים מהמאגר שלנו (שם + קטגוריה גסה
 * לפי הדירוג, לא צריך יותר מזה) ומבקשת: (א) שם השכונה/האזור המוכר
 * שהם נמצאים בו, (ב) לבחור **אחד מהם, בדיוק באותו איות** כעוגן. אם
 * הבחירה לא תואמת אף מועמד בדיוק - נכשל (לא מנחשים/מתקנים שם).
 */
async function identifyNeighborhoodFromCandidates(
  destination: string,
  candidates: NeighborhoodCandidateRow[]
): Promise<CentralNeighborhoodInfo | null> {
  const namesList = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");

  const prompt = `הנה רשימת מקומות אמיתיים (ממאגר תיירות מאומת) שנמצאים קרוב למרכז היעד "${destination}":
${namesList}

על סמך הידע הכללי שלך על ${destination} - באיזו שכונה/אזור מוכר ותיירותי רוב המקומות האלה נמצאים?
בחר גם אחד מהמקומות ברשימה (בדיוק כפי שהוא כתוב למעלה, בלי לשנות אף אות) כדי לשמש נקודת עוגן לשכונה הזו.

השב אך ורק במבנה JSON, בלי שום טקסט נוסף:
{"neighborhoodName": "שם השכונה", "anchorPlaceName": "העתקה מדויקת של שם אחד מהרשימה למעלה"}`;

  const { text, error } = await callClaude(prompt, 300);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { neighborhoodName?: string; anchorPlaceName?: string };
    if (!parsed.neighborhoodName || !parsed.anchorPlaceName) return null;

    const anchor = candidates.find((c) => c.name === parsed.anchorPlaceName);
    if (!anchor) {
      logAiError("Claude בחר עוגן שלא קיים ברשימה שנמסרה לו - לא ממציאים קואורדינטות", {
        destination,
        chosen: parsed.anchorPlaceName,
      });
      return null;
    }

    return {
      name: parsed.neighborhoodName.trim(),
      coords: { lat: anchor.latitude, lng: anchor.longitude },
      imageUrl: anchor.image_urls?.[0] ?? null,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח זיהוי השכונה", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      destination,
    });
    return null;
  }
}

async function findViaGoogleFallback(destination: string): Promise<CentralNeighborhoodInfo | null> {
  const name = await suggestNeighborhoodName(destination);
  if (!name) return null;

  // "{שם השכונה}, {יעד}" - בלי היעד המלא, גיאוקודינג לשם שכונה קצר
  // ונפוץ (למשל "העיר העתיקה") עלול "לברוח" ליעד אחר בעולם.
  const coords = await geocodePlaceName(`${name}, ${destination}`);
  if (!coords) {
    logAiError("לא הצלחנו למקם את השכונה המרכזית שהוצעה", { destination, name });
    return null;
  }

  const photoRef = await findPlacePhotoReference(`${name} ${destination}`);
  const imageUrl = photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null;

  return { name, coords, imageUrl };
}

async function suggestNeighborhoodName(destination: string): Promise<string | null> {
  const prompt = `מהי השכונה/האזור המרכזי, התוסס והתיירותי ביותר להליכה חופשית ביום ההגעה
של חופשה ב-"${destination}"? לדוגמה: פלאקה לאתונה, בורן לברצלונה, מונמארטר לפריז,
טרסטוורה לרומא. ענה בשם השכונה עצמה, לא באתר ספציפי בתוכה.

השב אך ורק במבנה JSON, בלי שום טקסט נוסף: {"neighborhood": "שם השכונה"}`;

  const { text, error } = await callClaude(prompt, 200);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { neighborhood?: string };
    return parsed.neighborhood?.trim() || null;
  } catch (parseError) {
    logAiError("כשל בזיהוי השכונה המרכזית", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      destination,
    });
    return null;
  }
}
