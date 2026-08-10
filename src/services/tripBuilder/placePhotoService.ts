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
 * מחלץ את שם העיר (locality) לפי קואורדינטות, באמצעות Geocoding API
 * (reverse geocoding) - נקרא רק כשלא סופקה עיר ידנית, כדי להשלים אותה
 * אוטומטית לפי מה שגוגל בפועל מזהה במיקום שנמצא בחיפוש.
 *
 * `locality` הוא השם התקני של "עיר" אצל גוגל; כשהוא חסר (למשל אזורים
 * כפריים/פארקים לאומיים) יש נפילה ל-`postal_town` ואז ל-`administrative_area_level_2`
 * כדי עדיין להחזיר משהו שימושי במקום ערך ריק.
 */
export async function resolveCityFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&language=he`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const results: Array<{ address_components: Array<{ long_name: string; types: string[] }> }> = data?.results ?? [];

    const findComponent = (type: string): string | null => {
      for (const result of results) {
        const match = result.address_components?.find((c) => c.types.includes(type));
        if (match) return match.long_name;
      }
      return null;
    };

    return findComponent("locality") ?? findComponent("postal_town") ?? findComponent("administrative_area_level_2") ?? null;
  } catch (error) {
    logAiError("שגיאה בזיהוי עיר לפי קואורדינטות (reverse geocoding)", {
      message: error instanceof Error ? error.message : String(error),
      latitude,
      longitude,
    });
    return null;
  }
}

/**
 * אותה קריאת Text Search בדיוק כמו findPlacePhotoReference - אבל גם קוראת
 * את שדה business_status שגוגל כבר מחזיר בתשובה הזו (בלי עלות נוספת!).
 * בלעדיו, מקום שנסגר לצמיתות/זמנית עדיין נכנס למסלול כאילו הוא פתוח -
 * המידע פשוט נזרק בלי שנעשה איתו כלום.
 *
 * גם מחזירה `exists` - קריטי נגד "המצאות" של Claude: אם גוגל מחזיר 0
 * תוצאות לשם שהוא הציע, המקום כנראה לא קיים במציאות ואסור לכלול אותו
 * במסלול, גם אם יש לו קואורדינטות (geocoding יכול "לנחש" מיקום קרוב גם
 * לשם שלא קיים בכלל). וגם `rating`/`ratingCount`/`googleName` - שגוגל כבר
 * מחזיר באותה קריאה בדיוק, בלי עלות נוספת, ופשוט נזרקו קודם בלי שימוש.
 */
export async function findPlaceStatusAndPhoto(query: string): Promise<{
  photoRef: string | null;
  isClosed: boolean;
  exists: boolean;
  googleName: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** קואורדינטות מדויקות של העסק/המקום עצמו, מתוך אותה תוצאה בדיוק -
   *  מדויק משמעותית מ-geocodePlaceNameNear (Geocoding API, שנועד לכתובות
   *  רחוב, לא לעסקים לא-רשמיים כמו עגלת קפה בתוך פארק - שם הוא לרוב
   *  מחזיר את מרכז הפארק/הרחוב, לא את המיקום המדויק של העסק). */
  latitude: number | null;
  longitude: number | null;
  /** סוגי המקום לפי גוגל (למשל "lodging", "restaurant", "park") - קריטי
   *  נגד "המצאות עדינות": מקום אמיתי (עובר "exists") שClaude שיבץ לתפקיד
   *  שלא מתאים לו בכלל (למשל בית מלון שתואר כשביל טבע). */
  types: string[];
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logAiError("GOOGLE_MAPS_API_KEY אינו מוגדר - לא ניתן לחפש תמונת מקום", {});
    // כשאין מפתח API בכלל - לא ניתן לאמת קיום, אז לא נכון "לפסול" את כל
    // המקומות (exists: true) - זה מצב תצורה חריג, לא סימן להמצאה.
    return { photoRef: null, isClosed: false, exists: true, googleName: null, rating: null, ratingCount: null, latitude: null, longitude: null, types: [] };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) {
      logAiError("חיפוש תמונת מקום נכשל (HTTP)", { query, httpStatus: response.status });
      return { photoRef: null, isClosed: false, exists: true, googleName: null, rating: null, ratingCount: null, latitude: null, longitude: null, types: [] };
    }

    const data = await response.json();
    const topResult = data?.results?.[0];

    // גוגל לא מצא שום תוצאה לשם הזה - הסימן החזק ביותר שהמקום מומצא ולא
    // קיים במציאות. לא בודקים רק "יש/אין תמונה", אלא האם גוגל בכלל מכיר
    // עסק/אתר בשם הזה.
    const exists = data?.status === "OK" && Boolean(topResult);
    if (!exists) {
      logAiError("Google Places לא מצא מקום כזה בכלל - חשד להמצאה", { query, googleStatus: data?.status });
      return { photoRef: null, isClosed: false, exists: false, googleName: null, rating: null, ratingCount: null, latitude: null, longitude: null, types: [] };
    }

    const businessStatus = topResult?.business_status;
    const isClosed = businessStatus === "CLOSED_TEMPORARILY" || businessStatus === "CLOSED_PERMANENTLY";
    if (isClosed) {
      logAiError("מקום מוצע נמצא סגור (זמנית/לצמיתות) - נפסל", { query, businessStatus });
    }

    const googleName: string | null = typeof topResult?.name === "string" ? topResult.name : null;
    const types: string[] = Array.isArray(topResult?.types) ? topResult.types : [];
    const rating: number | null = typeof topResult?.rating === "number" ? topResult.rating : null;
    const ratingCount: number | null =
      typeof topResult?.user_ratings_total === "number" ? topResult.user_ratings_total : null;
    const latitude: number | null = typeof topResult?.geometry?.location?.lat === "number" ? topResult.geometry.location.lat : null;
    const longitude: number | null = typeof topResult?.geometry?.location?.lng === "number" ? topResult.geometry.location.lng : null;

    const photoRef = topResult?.photos?.[0]?.photo_reference;
    if (typeof photoRef !== "string") {
      logAiError("חיפוש תמונת מקום לא החזיר תמונה", { query, googleStatus: data?.status });
      return { photoRef: null, isClosed, exists, googleName, rating, ratingCount, latitude, longitude, types };
    }
    return { photoRef, isClosed, exists, googleName, rating, ratingCount, latitude, longitude, types };
  } catch (error) {
    logAiError("שגיאה בחיפוש תמונת מקום", {
      message: error instanceof Error ? error.message : String(error),
      query,
    });
    return { photoRef: null, isClosed: false, exists: true, googleName: null, rating: null, ratingCount: null, latitude: null, longitude: null, types: [] };
  }
}