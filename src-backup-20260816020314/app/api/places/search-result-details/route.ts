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
    fields: "name,formatted_address,geometry,rating,user_ratings_total,photos,types",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.result) {
    return NextResponse.json({ error: "לא הצלחנו למצוא את המקום" }, { status: 502 });
  }

  const result = data.result;
  const photoRef = result.photos?.[0]?.photo_reference as string | undefined;

  // תגיות - Google מחזיר "types" גנרי (restaurant, point_of_interest,
  // establishment...) - מסננים את הכלליים מדי ומתרגמים לעברית קריאה.
  const GENERIC_TYPES = new Set(["point_of_interest", "establishment", "premise", "geocode"]);
  const TYPE_LABELS: Record<string, string> = {
    restaurant: "מסעדה", cafe: "בית קפה", bar: "בר", night_club: "מועדון לילה",
    bakery: "מאפייה", meal_takeaway: "טייק אווי", meal_delivery: "משלוחים",
    food: "אוכל", tourist_attraction: "אטרקציה תיירותית", park: "פארק",
    museum: "מוזיאון", art_gallery: "גלריית אמנות", shopping_mall: "קניון",
    store: "חנות", lodging: "לינה", spa: "ספא", gym: "חדר כושר",
    amusement_park: "פארק שעשועים", zoo: "גן חיות", aquarium: "אקווריום",
    church: "כנסייה", synagogue: "בית כנסת", mosque: "מסגד", hindu_temple: "מקדש",
    beach: "חוף", natural_feature: "אתר טבע", place_of_worship: "מקום פולחן",
    movie_theater: "קולנוע", stadium: "אצטדיון", casino: "קזינו",
  };
  const tags = ((result.types as string[] | undefined) ?? [])
    .filter((t) => !GENERIC_TYPES.has(t))
    .map((t) => TYPE_LABELS[t] ?? t.replace(/_/g, " "))
    .slice(0, 6);

  return NextResponse.json({
    placeId,
    name: result.name as string,
    address: result.formatted_address as string,
    latitude: result.geometry?.location?.lat as number,
    longitude: result.geometry?.location?.lng as number,
    rating: (result.rating as number | undefined) ?? null,
    ratingCount: (result.user_ratings_total as number | undefined) ?? null,
    imageUrl: photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null,
    tags,
  });
}
