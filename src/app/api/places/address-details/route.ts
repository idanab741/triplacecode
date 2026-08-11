import { NextResponse } from "next/server";
import { buildShortAddressLabel } from "@/services/places/shortAddressLabel";

/** ממירה place_id (מהשלמה אוטומטית של כתובת) לפרטים מלאים - כתובת, עיר,
 *  קואורדינטות. המפתח נשאר בצד השרת. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "יש לספק placeId" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    language: "he",
    fields: "formatted_address,address_component,geometry",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.result) {
    return NextResponse.json({ error: "לא הצלחנו למצוא את פרטי הכתובת" }, { status: 502 });
  }

  const result = data.result;
  const cityComponent = result.address_components?.find((c: { types: string[] }) => c.types.includes("locality"));

  return NextResponse.json({
    // *** תיקון: אותו תיקון כמו ב-reverse-geocode - label קצר במקום
    // formatted_address המלא (עם מיקוד+מדינה).
    address_text: buildShortAddressLabel(result.address_components, result.formatted_address as string),
    city: (cityComponent?.long_name as string | undefined) ?? null,
    latitude: result.geometry?.location?.lat as number | undefined,
    longitude: result.geometry?.location?.lng as number | undefined,
  });
}
