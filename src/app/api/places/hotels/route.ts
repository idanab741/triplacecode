import { NextResponse } from "next/server";

/**
 * השלמה אוטומטית לשמות מלונות דרך Google Places Autocomplete API, עם
 * הטיה לסוג "lodging" (מלונות/צימרים/הוסטלים וכו') - לא מקומות כלליים.
 * בעת בחירת הצעה, מביא גם את הכתובת המלאה (place details) כדי שהמשתמש
 * לא יצטרך להקליד אותה ידנית.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const placeId = searchParams.get("placeId");

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
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&types=lodging&key=${apiKey}&language=he`;
    const response = await fetch(url);
    const data = await response.json();

    const hotels = (data?.predictions ?? []).map((p: { place_id: string; description: string }) => ({
      placeId: p.place_id,
      description: p.description,
    }));

    return NextResponse.json({ hotels });
  } catch {
    return NextResponse.json({ hotels: [] });
  }
}
