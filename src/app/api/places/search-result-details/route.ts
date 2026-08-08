import { NextResponse } from "next/server";

/** מחזירה פרטים מלאים על מקום לפי placeId (מהשלמה אוטומטית) - שם, כתובת,
 *  קואורדינטות, דירוג, תמונה - לעמוד תוצאת חיפוש ספציפית. אותו מפתח
 *  שרת בלבד כמו בכל שאר ה-endpoints של Google Places באפליקציה. */
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
    fields: "name,formatted_address,geometry,rating,user_ratings_total,photo,types",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.result) {
    return NextResponse.json({ error: "לא הצלחנו למצוא את המקום" }, { status: 502 });
  }

  const result = data.result;
  const photoRef = result.photos?.[0]?.photo_reference as string | undefined;

  return NextResponse.json({
    placeId,
    name: result.name as string,
    address: result.formatted_address as string,
    latitude: result.geometry?.location?.lat as number,
    longitude: result.geometry?.location?.lng as number,
    rating: (result.rating as number | undefined) ?? null,
    ratingCount: (result.user_ratings_total as number | undefined) ?? null,
    imageUrl: photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null,
  });
}
