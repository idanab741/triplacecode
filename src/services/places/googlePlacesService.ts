/** צורת הנתונים הגולמית שחוזרת מ-Google Places API (New) - Text Search. */
export interface GooglePlaceRaw {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name: string }[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  editorialSummary?: { text: string };
  primaryTypeDisplayName?: { text: string };
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.photos",
  "places.regularOpeningHours",
  "places.types",
  "places.editorialSummary",
  "places.primaryTypeDisplayName",
  "places.accessibilityOptions",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
].join(",");

async function textSearchGooglePlaces(textQuery: string): Promise<GooglePlaceRaw[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY אינו מוגדר ב-.env.local");
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, languageCode: "he" }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`שגיאה מ-Google Places API (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.places ?? [];
}

interface SearchGooglePlacesParams {
  city: string;
  query: string;
}

/** מושך יעדים מ-Google Places API (New) - Text Search, לפי עיר וטקסט חיפוש. */
export async function searchGooglePlaces({
  city,
  query,
}: SearchGooglePlacesParams): Promise<GooglePlaceRaw[]> {
  return textSearchGooglePlaces(`${query} ב${city}`);
}

/** מחזיר את התוצאה המובילה עבור שאילתת עיר (לשימוש בטבלת destinations). */
export async function searchCityPlace(searchQuery: string): Promise<GooglePlaceRaw | null> {
  const results = await textSearchGooglePlaces(searchQuery);
  return results[0] ?? null;
}

/** מחלץ עיר ומדינה מתוך addressComponents של גוגל, אם קיימים. */
export function extractCityAndCountry(raw: GooglePlaceRaw): { city: string | null; country: string | null } {
  const components = raw.addressComponents ?? [];
  const city =
    components.find((c) => c.types.includes("locality"))?.longText ??
    components.find((c) => c.types.includes("postal_town"))?.longText ??
    components.find((c) => c.types.includes("administrative_area_level_2"))?.longText ??
    null;
  const country = components.find((c) => c.types.includes("country"))?.longText ?? null;
  return { city, country };
}