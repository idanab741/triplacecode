import { logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "./geocodingService";
import { haversineDistanceKm } from "./geo";
import type { LatLng } from "./types";

export interface AirportInfo {
  /** שם שדה התעופה המרכזי, בעברית אם גוגל מחזיר תרגום (בד"כ כן לערים מוכרות) */
  name: string;
  coords: LatLng;
  imageUrl: string | null;
}

/**
 * מוצא את שדה התעופה המרכזי של יעד (למשל "אתונה" -> "נמל התעופה הבינלאומי
 * של אתונה"), כולל תמונה - קריאה אחת בלבד, שהלקוח משתמש בה גם לתצוגה וגם
 * לבניית קישור הזמנת נסיעה (Google Maps directions).
 */
export async function findAirportInfo(destination: string): Promise<AirportInfo | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logAiError("GOOGLE_MAPS_API_KEY אינו מוגדר - לא ניתן לאתר שדה תעופה", {});
    return null;
  }

  try {
    // חובה לאתר קודם את קואורדינטות היעד עצמו, ולהטות את חיפוש שדה התעופה
    // סביבן (location+radius) - בלי זה, Text Search בלי שום הטיה גיאוגרפית
    // יכול "ליפול" על מקום לא קשור בכלל ליעד (למשל שדה תעופה קרוב לשרת/
    // למיקום ברירת המחדל של גוגל), כמו נתב"ג בישראל לחיפוש טיסה לפריז.
    const destinationCoords = await geocodePlaceName(destination);
    if (!destinationCoords) {
      logAiError("לא הצלחנו לאתר את קואורדינטות היעד - מוותרים על חיפוש שדה תעופה", { destination });
      return null;
    }

    const query = `שדה תעופה בינלאומי ${destination}`;
    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}` +
      `&type=airport&location=${destinationCoords.lat},${destinationCoords.lng}&radius=100000` +
      `&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) {
      logAiError("חיפוש שדה תעופה נכשל (HTTP)", { destination, httpStatus: response.status });
      return null;
    }

    const data = await response.json();
    const topResult = data?.results?.[0];
    const location = topResult?.geometry?.location;
    if (!topResult?.name || !location) {
      logAiError("חיפוש שדה תעופה לא החזיר תוצאה", { destination, googleStatus: data?.status });
      return null;
    }

    // בדיקת שפיות אחרונה: גם עם ה-location bias, לוודא שהתוצאה לא רחוקה
    // באופן קיצוני מהיעד (אם למשל ה-bias התעלם מסיבה כלשהי) - אם המרחק
    // עצום (מעל 300 ק"מ), עדיף בלי שדה תעופה בכלל מאשר שדה תעופה שגוי.
    const distanceKm = haversineDistanceKm(destinationCoords, { lat: location.lat, lng: location.lng });
    if (distanceKm > 300) {
      logAiError("שדה התעופה שנמצא רחוק מדי מהיעד - נפסל", { destination, distanceKm: Math.round(distanceKm) });
      return null;
    }

    const coords: LatLng = { lat: location.lat, lng: location.lng };
    const photoRef = topResult?.photos?.[0]?.photo_reference;
    const imageUrl = typeof photoRef === "string" ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null;

    return { name: topResult.name, coords, imageUrl };
  } catch (error) {
    logAiError("שגיאה באיתור שדה תעופה", {
      message: error instanceof Error ? error.message : String(error),
      destination,
    });
    return null;
  }
}
