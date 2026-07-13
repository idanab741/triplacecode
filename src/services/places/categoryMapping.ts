/**
 * מיפוי בין הקטגוריות שלנו (אותם מזהים כמו ב-locales/he/preferences.ts,
 * תחת INTERESTS) לבין מחרוזות חיפוש ב-Google Places וסוגי המקומות
 * (types) שגוגל מחזירה.
 */

/** שאילתת טקסט לחיפוש ב-Google Places, לפי הקטגוריה שלנו. */
export const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  coffee_carts_cafes: "בתי קפה",
  restaurants_culinary: "מסעדות",
  nature_landscapes: "טבע ונופים",
  museums_history: "מוזיאונים",
  culture_art: "גלריות ואמנות",
  shopping: "קניות",
  nightlife: "חיי לילה",
  relaxation_spa: "ספא",
};

const GOOGLE_TYPE_TO_CATEGORY: Record<string, string> = {
  cafe: "coffee_carts_cafes",
  coffee_shop: "coffee_carts_cafes",
  restaurant: "restaurants_culinary",
  meal_takeaway: "restaurants_culinary",
  park: "nature_landscapes",
  natural_feature: "nature_landscapes",
  hiking_area: "nature_landscapes",
  museum: "museums_history",
  art_gallery: "culture_art",
  shopping_mall: "shopping",
  store: "shopping",
  night_club: "nightlife",
  bar: "nightlife",
  spa: "relaxation_spa",
};

/** מנרמל את מערך ה-types שגוגל מחזירה למזהה קטגוריה שלנו, אם מוכר. */
export function normalizeGoogleCategory(types: string[] | undefined): string | null {
  if (!types) return null;
  for (const type of types) {
    const mapped = GOOGLE_TYPE_TO_CATEGORY[type];
    if (mapped) return mapped;
  }
  return null;
}
