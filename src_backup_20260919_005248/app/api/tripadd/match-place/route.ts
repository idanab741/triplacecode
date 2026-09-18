import { NextResponse } from "next/server";
import { matchGooglePlaceByLocation, geocodeAddress, extractCityAndCountry } from "@/services/places/googlePlacesService";

/**
 * *** תוספת (בקשה מפורשת - מסמך העדכון, סעיפים 2-6): ה-endpoint
 * שמחליף את ה-autocomplete הגלוי. נקרא **פעם אחת** כשהמשתמש מסיים
 * להקליד את שם המקום ולוחץ "המשך" (לא על כל תו - סעיף 30, ביצועים) -
 * לא מחזיר רשימת הצעות לבחירה, רק תוצאה סופית אחת (matched=true) או
 * כלום (matched=false), בדיוק לפי הדיאגרמה במסמך:
 *
 *   User enters name -> Backend searches Google -> matching logic ->
 *   potential match identified -> store Google Place ID + metadata
 *
 * שני מצבי קלט:
 * - {name, latitude, longitude}: יש מיקום GPS מהמכשיר - מחפש בגוגל
 *   עם locationBias (סעיף 4 - "אין לבצע matching לפי שם בלבד").
 * - {address} בלבד (בלי GPS - סעיף 6, אפשרות A): geocoding בלבד, בלי
 *   ניסיון להתאים לישות גוגל ספציפית - רק קואורדינטות למפה.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const latitude = body?.latitude as number | undefined;
  const longitude = body?.longitude as number | undefined;
  const address = body?.address as string | undefined;

  try {
    if (name && typeof latitude === "number" && typeof longitude === "number") {
      const match = await matchGooglePlaceByLocation({ name, latitude, longitude });
      if (match?.location) {
        const { city } = extractCityAndCountry(match);
        return NextResponse.json({
          matched: true,
          googlePlaceId: match.id,
          address: match.formattedAddress ?? null,
          city,
          latitude: match.location.latitude,
          longitude: match.location.longitude,
          rating: match.rating ?? null,
          ratingCount: match.userRatingCount ?? null,
          confidence: 0.75, // ר' הערת matchGooglePlaceByLocation - הערכה גסה, לא ציון AI
        });
      }
      // *** לא נמצאה התאמה - עדיין יש GPS, אז המקום עדיין ימוקם נכון
      // על המפה (סעיף 6: "TRIPLACE name + coordinates" גם בלי match).
      return NextResponse.json({ matched: false, latitude, longitude, address: null, city: null });
    }

    if (address) {
      const geocoded = await geocodeAddress(address);
      if (!geocoded) return NextResponse.json({ matched: false, error: "לא הצלחנו לאתר את הכתובת הזו" }, { status: 422 });
      return NextResponse.json({
        matched: false,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        address: geocoded.formattedAddress,
        city: null,
      });
    }

    return NextResponse.json({ error: "חסר name+latitude+longitude או address" }, { status: 422 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
