import { logAiError } from "@/services/ai/claudeService";
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
    if (!response.ok) return null;

    const data = await response.json();
    const location = data?.results?.[0]?.geometry?.location;
    if (!location) return null;

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    logAiError("שגיאה בגיאוקודינג", {
      message: error instanceof Error ? error.message : String(error),
      placeName,
    });
    return null;
  }
}