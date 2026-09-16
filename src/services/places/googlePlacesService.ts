/** צורת הנתונים הגולמית שחוזרת מ-Google Places API (New) - Text Search. */
export interface GooglePlaceRaw {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types?: string[] }[];
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name: string }[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  /** האם המקום פתוח *כרגע* בפועל (לא רק לוח השבועי הכללי) - Google
   *  מחשב את זה בעצמו לפי הזמן האמיתי בזמן הבקשה. */
  currentOpeningHours?: { openNow?: boolean };
  types?: string[];
  editorialSummary?: { text: string };
  primaryTypeDisplayName?: { text: string };
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
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
  "places.currentOpeningHours",
  "places.types",
  "places.editorialSummary",
  "places.primaryTypeDisplayName",
  "places.accessibilityOptions",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
].join(",");

async function textSearchGooglePlaces(textQuery: string, locationBias?: { latitude: number; longitude: number; radiusMeters: number }): Promise<GooglePlaceRaw[]> {
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
    body: JSON.stringify({
      textQuery,
      languageCode: "he",
      ...(locationBias && {
        locationBias: {
          circle: {
            center: { latitude: locationBias.latitude, longitude: locationBias.longitude },
            radius: locationBias.radiusMeters,
          },
        },
      }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`שגיאה מ-Google Places API (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.places ?? [];
}

/**
 * *** תוספת (בקשה מפורשת - מסמך העדכון, סעיפים 2-4: "ה-matching
 * צריך להתבצע מאחורי הקלעים... לא לבצע matching לפי שם בלבד"):
 * מחפש בגוגל לפי שם **וגם** מיקום (locationBias, לא רק טקסט חופשי) -
 * כדי לצמצם בלבול בין כמה מקומות באותו שם (למשל "Central Park").
 * ה"אמון" בהתאמה כאן פשוט ומודע-למגבלותיו בכוונה: אין כאן ציון
 * דמיון-שמות מתוחכם (embeddings/AI) - רק "יש תוצאה בתוך הרדיוס
 * שביקשנו, והיא התוצאה המובילה שגוגל עצמו דירג הכי רלוונטית לשילוב
 * הזה של טקסט+מיקום". זה שלב ראשון סביר, לא "AI matching" מלא לפי
 * סעיף 27 במסמך - שיפור עתידי אפשרי, לא נבנה כרגע.
 */
export async function matchGooglePlaceByLocation(params: {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}): Promise<GooglePlaceRaw | null> {
  const results = await textSearchGooglePlaces(params.name, {
    latitude: params.latitude,
    longitude: params.longitude,
    radiusMeters: params.radiusMeters ?? 300,
  });
  return results[0] ?? null;
}

interface GeocodedAddress {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * *** תוספת (בקשה מפורשת - מסמך העדכון, סעיף 6, אפשרות A - "לא
 * הצלחנו לזהות את המקום, נא להוסיף כתובת"): כשאין GPS זמין ואין
 * התאמת גוגל, המשתמש מקליד כתובת חופשית - זה ממיר אותה לקואורדינטות
 * אמיתיות (Google Geocoding API, לא Places) כדי שהמקום עדיין יוכל
 * להופיע על המפה. לא בונה כאן את אפשרות B (מיקום ידני על מפה בגרירה) -
 * זו הרחבה עתידית נפרדת, לא בסבב הזה.
 */
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY אינו מוגדר ב-.env.local");

  const params = new URLSearchParams({ address, key: apiKey, language: "he" });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await response.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
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
    components.find((c) => c.types?.includes("locality"))?.longText ??
    components.find((c) => c.types?.includes("postal_town"))?.longText ??
    components.find((c) => c.types?.includes("administrative_area_level_2"))?.longText ??
    null;
  const country = components.find((c) => c.types?.includes("country"))?.longText ?? null;
  return { city, country };
}