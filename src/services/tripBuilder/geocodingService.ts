import { logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm } from "./geo";
import type { LatLng } from "./types";

/**
 * ממיר שם מקום (עיר/שכונה/אתר) לקואורדינטות, באמצעות Google Geocoding API.
 * משמש כאשר המלל החופשי מזכיר מקום ספציפי (כמו "יום ביפו") - כדי לבנות את
 * הטיול סביב האזור המבוקש, במקום סביב הבית של המשתמש.
 */
export async function geocodePlaceName(placeName: string): Promise<LatLng | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logAiError("GOOGLE_MAPS_API_KEY אינו מוגדר - לא ניתן לבצע גיאוקודינג", {});
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      placeName
    )}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) {
      logAiError("קריאת גיאוקודינג נכשלה (HTTP)", { placeName, httpStatus: response.status });
      return null;
    }

    const data = await response.json();
    const location = data?.results?.[0]?.geometry?.location;
    if (!location) {
      // סטטוס גוגל (למשל REQUEST_DENIED / OVER_QUERY_LIMIT / ZERO_RESULTS) הוא
      // בדיוק המידע שהיה חסר קודם - בלי זה, מפתח API פגום/חסום נכשל בשקט
      // גמור לכל מקום, בלי שום עקבה בלוג.
      logAiError("גיאוקודינג לא החזיר מיקום", {
        placeName,
        googleStatus: data?.status,
        googleErrorMessage: data?.error_message,
      });
      return null;
    }

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    logAiError("שגיאה בגיאוקודינג", {
      message: error instanceof Error ? error.message : String(error),
      placeName,
    });
    return null;
  }
}

/**
 * כמו geocodePlaceName, אבל פוסל תוצאה שנופלת רחוק מהיעד המבוקש.
 * קריטי עבור הצעות AI (Claude יכול "להמציא" שם, או לתת שם שקיים גם בעיר/מדינה
 * אחרת) - בלי הבדיקה הזו, גיאוקודינג רופף עלול להחזיר קואורדינטות בצד השני
 * של העולם, וזה "נדבק" למסלול כתחנה שלא שייכת ליעד בכלל.
 * maxDistanceKm ברירת מחדל 60 ק"מ - מכסה עיר גדולה + פרברים קרובים, בלי
 * לאפשר "קפיצה" לעיר/מדינה אחרת.
 */
export async function geocodePlaceNameNear(
  placeName: string,
  near: LatLng,
  maxDistanceKm = 60
): Promise<LatLng | null> {
  const coords = await geocodePlaceName(placeName);
  if (!coords) return null;

  const distanceKm = haversineDistanceKm(near, coords);
  if (distanceKm > maxDistanceKm) {
    logAiError("גיאוקודינג הוחזר רחוק מדי מהיעד - נפסל", {
      placeName,
      distanceKm: Math.round(distanceKm),
      maxDistanceKm,
    });
    return null;
  }

  return coords;
}