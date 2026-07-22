import { logAiError } from "@/services/ai/claudeService";

/**
 * מחפש ב-Google Places תמונה אמיתית של מקום/אזור לפי שם, ומחזיר את ה-photo_reference
 * (מזהה זמני של גוגל לתמונה) - לא את התמונה עצמה. התמונה בפועל נטענת דרך
 * הפרוקסי שלנו (/api/places/photo), כדי לא לחשוף את מפתח ה-API בדפדפן.
 */
export async function findPlacePhotoReference(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const photoRef = data?.results?.[0]?.photos?.[0]?.photo_reference;
    return typeof photoRef === "string" ? photoRef : null;
  } catch (error) {
    logAiError("שגיאה בחיפוש תמונת מקום", {
      message: error instanceof Error ? error.message : String(error),
      query,
    });
    return null;
  }
}