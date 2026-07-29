import { NextResponse } from "next/server";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";

/**
 * השלמה אוטומטית לשמות מלונות דרך Google Places Autocomplete API, עם
 * הטיה לסוג "lodging" (מלונות/צימרים/הוסטלים וכו') - לא מקומות כלליים.
 * אם סופק destination - מטים חזק (locationbias) לאזור הגיאוגרפי של היעד,
 * כדי שלא יחזרו מלונות מכל העולם עבור חיפוש טקסט כללי (למשל שם מלון נפוץ
 * שקיים גם בכמה מדינות אחרות).
 * בעת בחירת הצעה, מביא גם את הכתובת המלאה (place details) כדי שהמשתמש
 * לא יצטרך להקליד אותה ידנית.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const placeId = searchParams.get("placeId");
  const destination = searchParams.get("destination")?.trim();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY אינו מוגדר" }, { status: 500 });
  }

  // אם התקבל placeId - מחזירים את פרטי המקום המלאים (שם + כתובת), לא רשימת הצעות
  if (placeId) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        placeId
      )}&fields=name,formatted_address&key=${apiKey}&language=he`;
      const response = await fetch(url);
      const data = await response.json();
      const result = data?.result;
      if (!result) return NextResponse.json({ error: "המקום לא נמצא" }, { status: 404 });

      return NextResponse.json({
        name: result.name as string,
        address: result.formatted_address as string,
      });
    } catch {
      return NextResponse.json({ error: "שגיאה בשליפת פרטי המלון" }, { status: 500 });
    }
  }

  if (query.length < 2) return NextResponse.json({ hotels: [] });

  try {
    let locationBiasParam = "";
    if (destination) {
      const coords = await geocodePlaceName(destination);
      if (coords) {
        // רדיוס גדול (100 ק"מ) - מספיק לכסות עיר/אזור שלם ביעד, בלי להגביל
        // יותר מדי אם המלון נמצא קצת מחוץ למרכז העיר.
        locationBiasParam = `&locationbias=circle:100000@${coords.lat},${coords.lng}`;
      }
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&types=lodging${locationBiasParam}&key=${apiKey}&language=he`;
    const response = await fetch(url);
    const data = await response.json();

    // לוג + מצב שקוף ללקוח: קודם כישלון כאן היה שקט לגמרי (בלי לוג, בלי
    // אינדיקציה בתצוגה) - בדיוק כמו הבאגים הקודמים בגיאוקודינג/תמונות
    // שכבר תיקנו. status של גוגל שאינו OK/ZERO_RESULTS (למשל REQUEST_DENIED,
    // INVALID_REQUEST, OVER_QUERY_LIMIT) הוא בדיוק המידע שהיה חסר.
    if (data?.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Hotels Autocomplete] גוגל החזיר שגיאה", {
        googleStatus: data.status,
        errorMessage: data.error_message,
        query,
        destination,
      });
      return NextResponse.json({ hotels: [], googleStatus: data.status, googleErrorMessage: data.error_message });
    }

    const hotels = (data?.predictions ?? []).map((p: { place_id: string; description: string }) => ({
      placeId: p.place_id,
      description: p.description,
    }));

    return NextResponse.json({ hotels });
  } catch (error) {
    console.error("[Hotels Autocomplete] שגיאת רשת/קוד", {
      message: error instanceof Error ? error.message : String(error),
      query,
      destination,
    });
    return NextResponse.json({ hotels: [], googleErrorMessage: "שגיאת רשת" });
  }
}
