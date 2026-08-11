import { NextResponse } from "next/server";
import { buildShortAddressLabel } from "@/services/places/shortAddressLabel";

/** ממירה קואורדינטות לכתובת קריאה (Google Geocoding API) - המפתח נשאר
 *  בצד השרת בלבד, בשימוש ל"השתמש במיקום הנוכחי שלי" בבחירת מיקום. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "יש לספק lat ו-lng" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: apiKey, language: "he" });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.results?.[0]) {
    return NextResponse.json({ error: "לא הצלחנו לזהות כתובת במיקום הזה" }, { status: 502 });
  }

  const result = data.results[0];
  const cityComponent = result.address_components?.find((c: { types: string[] }) => c.types.includes("locality"));

  return NextResponse.json({
    // *** תיקון: לפני זה formatted_address (כולל מיקוד+מדינה - ארוך מדי
    // לתצוגה). עכשיו label קצר "רחוב ומספר, עיר" בלבד.
    address_text: buildShortAddressLabel(result.address_components, result.formatted_address as string),
    city: (cityComponent?.long_name as string | undefined) ?? null,
  });
}
