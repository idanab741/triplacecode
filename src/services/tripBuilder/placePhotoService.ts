import { logAiError } from "@/services/ai/claudeService";

/**
 * מחפש ב-Google Places תמונה אמיתית של מקום/אזור לפי שם, ומחזיר את ה-photo_reference
 * (מזהה זמני של גוגל לתמונה) - לא את התמונה עצמה. התמונה בפועל נטענת דרך
 * הפרוקסי שלנו (/api/places/photo), כדי לא לחשוף את מפתח ה-API בדפדפן.
 */
export async function findPlacePhotoReference(query: string): Promise<string | null> {
  const result = await findPlaceStatusAndPhoto(query);
  return result.photoRef;
}

/**
 * אותה קריאת Text Search בדיוק כמו findPlacePhotoReference - אבל גם קוראת
 * את שדה business_status שגוגל כבר מחזיר בתשובה הזו (בלי עלות נוספת!).
 * בלעדיו, מקום שנסגר לצמיתות/זמנית עדיין נכנס למסלול כאילו הוא פתוח -
 * המידע פשוט נזרק בלי שנעשה איתו כלום.
 */
export async function findPlaceStatusAndPhoto(
  query: string
): Promise<{ photoRef: string | null; isClosed: boolean }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logAiError("GOOGLE_MAPS_API_KEY אינו מוגדר - לא ניתן לחפש תמונת מקום", {});
    return { photoRef: null, isClosed: false };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) {
      logAiError("חיפוש תמונת מקום נכשל (HTTP)", { query, httpStatus: response.status });
      return { photoRef: null, isClosed: false };
    }

    const data = await response.json();
    const topResult = data?.results?.[0];
    const businessStatus = topResult?.business_status;
    const isClosed = businessStatus === "CLOSED_TEMPORARILY" || businessStatus === "CLOSED_PERMANENTLY";
    if (isClosed) {
      logAiError("מקום מוצע נמצא סגור (זמנית/לצמיתות) - נפסל", { query, businessStatus });
    }

    const photoRef = topResult?.photos?.[0]?.photo_reference;
    if (typeof photoRef !== "string") {
      logAiError("חיפוש תמונת מקום לא החזיר תמונה", { query, googleStatus: data?.status });
      return { photoRef: null, isClosed };
    }
    return { photoRef, isClosed };
  } catch (error) {
    logAiError("שגיאה בחיפוש תמונת מקום", {
      message: error instanceof Error ? error.message : String(error),
      query,
    });
    return { photoRef: null, isClosed: false };
  }
}