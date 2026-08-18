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

/**
 * מאתר את "השכונה המרכזית" של יעד חופשה בחו"ל - לכרטיס יום 1 (ר'
 * injectLogisticsStops) ולעיגון רדיוס חיפוש מסעדת יום 1.
 *
 * בקשה מפורשת ("למה זה דרך גוגל, יש לך במאגר שלנו!!"): המקור הראשי הוא
 * עכשיו המאגר הפנימי (places) - מחפשים את המקום המדורג הכי גבוה שאדמין
 * כבר תייג כאתר-חובה/מורשת/תרבות/תצפית קרוב למרכז היעד, ומשתמשים בשם
 * ובתמונה **שלו** (לא שם שכונה כללי שה-AI ממציא). Google/Claude משמשים
 * רק כגיבוי אם אין שום מועמד מתאים אצלנו ביעד הזה בכלל - עדיף תוצאה
 * חיצונית אחת מאשר שום כרטיס יום 1.
 */
export async function findCentralNeighborhood(
  supabase: SupabaseClient,
  params: FindCentralNeighborhoodParams
): Promise<CentralNeighborhoodInfo | null> {
  const fromOurDb = await findFromOurDatabase(supabase, params.origin, params.radiusKm);
  if (fromOurDb) return fromOurDb;

  logAiError("אין מועמד מתאים במאגר שלנו לשכונה המרכזית - נופלים לגיבוי גוגל/Claude", {
    destination: params.destination,
  });
  return findViaGoogleFallback(params.destination);
}

interface NeighborhoodCandidateRow {
  name: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image_urls: string[] | null;
}

/** תגיות שסביר שמייצגות "מקום מרכזי/מוכר להסתובב בו" - לא כל אטרקציה גנרית. */
const NEIGHBORHOOD_CANDIDATE_TAGS = [
  "must_see_landmarks",
  "heritage",
  "culture_museums",
  "viewpoints",
  "general_attractions",
];

async function findFromOurDatabase(
  supabase: SupabaseClient,
  origin: LatLng,
  radiusKm: number
): Promise<CentralNeighborhoodInfo | null> {
  const latDelta = kmToDegreesLat(radiusKm);
  const lngDelta = kmToDegreesLng(radiusKm, origin.lat);

  const { data, error } = await supabase
    .from("places")
    .select("name,latitude,longitude,rating,image_urls")
    .eq("is_legacy", false)
    .neq("category", "nightlife")
    .overlaps("trip_type_tags", NEIGHBORHOOD_CANDIDATE_TAGS)
    .gte("latitude", origin.lat - latDelta)
    .lte("latitude", origin.lat + latDelta)
    .gte("longitude", origin.lng - lngDelta)
    .lte("longitude", origin.lng + lngDelta)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error || !data || data.length === 0) return null;

  const rows = data as NeighborhoodCandidateRow[];
  const withCoords = rows.filter((r) => r.latitude != null && r.longitude != null);
  if (withCoords.length === 0) return null;

  // רשת ביטחון אחרונה על מרחק בפועל (ה-bounding box למעלה מרובע, לא עיגול).
  const nearest = withCoords
    .map((r) => ({ row: r, distanceKm: haversineDistanceKm(origin, { lat: r.latitude!, lng: r.longitude! }) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!nearest) return null;

  return {
    name: nearest.row.name,
    coords: { lat: nearest.row.latitude!, lng: nearest.row.longitude! },
    imageUrl: nearest.row.image_urls?.[0] ?? null,
  };
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
