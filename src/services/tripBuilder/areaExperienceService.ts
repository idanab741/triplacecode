import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm, estimateTravelMinutes } from "./geo";
import type { CandidatePlace, LatLng } from "./types";

interface GetOrCreateParams {
  areaName: string;
  category: string;
  coords: LatLng;
  origin: LatLng;
}

/**
 * מייצר "חוויית אזור" (Walkable Experience) - כאשר אין מועמד מתאים ב-DB
 * (למשל "טיילת תל אביב" לא קיימת עדיין כשורה), Claude עצמו יוצר תיאור של
 * החוויה, ואנחנו שומרים אותה כשורה חדשה בטבלת places - כך שבפעם הבאה היא
 * כבר "קיימת" ולא צריך לקרוא ל-Claude שוב. ה-AI מוביל; ה-DB/אדמין הם רק
 * גיבוי וכלי עריכה ידנית, לא תנאי מקדים.
 */
export async function getOrCreateAreaExperience(
  supabase: SupabaseClient,
  params: GetOrCreateParams
): Promise<CandidatePlace | null> {
  const generated = await tryGenerateWithClaude(params);
  if (generated) {
    const saved = await saveAsPlace(supabase, generated, params);
    if (saved) return toCandidatePlace(saved, params.origin);
  }

  // Claude נתקע (שגיאה/timeout) - נופלים חזרה למה שכבר קיים ב-DB, אם קיים
  return findExistingAreaExperience(supabase, params);
}

async function tryGenerateWithClaude(
  params: GetOrCreateParams
): Promise<{ name: string; description: string; visitMinutes: number } | null> {
  const prompt = `אתה מכיר היטב את הגיאוגרפיה והאתרים בישראל. המשתמש מבקש לבלות ב"${params.areaName}",
בקטגוריה "${params.category}" - וטרם קיים אצלנו תיאור ל"חוויית הסתובבות" באזור הזה.

צור עבורנו תיאור קצר ומדויק לחוויה של הסתובבות ברגל באזור הזה - לא אטרקציה בודדת, אלא
האזור כולו כחוויה (רחובות, נקודות עניין, אווירה).

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "name": "שם קצר לחוויה, לדוגמה 'סיור ב...' או 'הסתובבות ב...'",
  "description": "משפט או שניים בעברית שמתארים את החוויה",
  "visitMinutes": מספר דקות מומלץ לביקור (בין 60 ל-200)
}`;

  const { text, error } = await callClaude(prompt, 400);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { name: string; description: string; visitMinutes: number };
    if (!parsed.name || !parsed.description) return null;
    return {
      name: parsed.name,
      description: parsed.description,
      visitMinutes: parsed.visitMinutes && parsed.visitMinutes > 0 ? parsed.visitMinutes : 120,
    };
  } catch (parseError) {
    logAiError("כשל ביצירת חוויית אזור", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}

interface SavedPlaceRow {
  id: string;
  name: string;
  short_description: string | null;
  latitude: number;
  longitude: number;
  estimated_visit_minutes: number | null;
}

async function saveAsPlace(
  supabase: SupabaseClient,
  generated: { name: string; description: string; visitMinutes: number },
  params: GetOrCreateParams
): Promise<SavedPlaceRow | null> {
  const { data, error } = await supabase
    .from("places")
    .insert({
      name: generated.name,
      short_description: generated.description,
      latitude: params.coords.lat,
      longitude: params.coords.lng,
      category: params.category,
      trip_type_tags: [params.category],
      is_area_experience: true,
      estimated_visit_minutes: generated.visitMinutes,
    })
    .select("id,name,short_description,latitude,longitude,estimated_visit_minutes")
    .single();

  if (error || !data) {
    logAiError("כשל בשמירת חוויית אזור שנוצרה ל-DB", { message: error?.message });
    return null;
  }
  return data as SavedPlaceRow;
}

async function findExistingAreaExperience(
  supabase: SupabaseClient,
  params: GetOrCreateParams
): Promise<CandidatePlace | null> {
  const { data } = await supabase
    .from("places")
    .select("id,name,short_description,latitude,longitude,estimated_visit_minutes")
    .eq("is_area_experience", true)
    .ilike("name", `%${params.areaName}%`)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return toCandidatePlace(data as SavedPlaceRow, params.origin);
}

function toCandidatePlace(row: SavedPlaceRow, origin: LatLng): CandidatePlace {
  const distanceKm = haversineDistanceKm(origin, { lat: row.latitude, lng: row.longitude });
  return {
    id: row.id,
    name: row.name,
    category: "",
    subcategory: null,
    shortDescription: row.short_description,
    imageUrls: [],
    rating: null,
    ratingCount: null,
    priceLevel: null,
    estimatedVisitMinutes: row.estimated_visit_minutes,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceKm,
    etaMinutes: estimateTravelMinutes(distanceKm, "drive"),
    tripTypeTags: [],
    cuisineTags: [],
    kosher: null,
    accessible: null,
    suitableChildAges: [],
    budgetTier: null,
    isAreaExperience: true,
  };
}