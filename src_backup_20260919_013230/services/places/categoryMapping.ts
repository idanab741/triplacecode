/**
 * מיפוי בין 13 סוגי המסלול שלנו (tripTaxonomy.ts) לבין מחרוזות חיפוש
 * ב-Google Places וסוגי המקומות (types) שגוגל מחזירה.
 */

/** שאילתת טקסט לחיפוש ב-Google Places, לפי סוג המסלול שלנו. */
export const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  coffee_carts_cafes: "בתי קפה",
  nature_trails: "טבע ומסלולי הליכה",
  beaches_pools: "חופים ובריכות",
  viewpoints: "תצפיות ונקודות נוף",
  parks_gardens: "פארקים וגנים",
  water_amusement_parks: "פארקי מים ושעשועים",
  attractions_activities: "אטרקציות ופעילויות",
  sports_extreme: "ספורט אתגרי אקסטרים",
  wineries_dining: "מסעדות יקבים ומבשלות",
  culture_history: "מוזיאונים ואתרי היסטוריה",
  shopping: "קניות ושווקים",
  events_festivals: "אירועים ופסטיבלים",
  spa_relaxation: "ספא ורוגע",
};

const GOOGLE_TYPE_TO_CATEGORY: Record<string, string> = {
  cafe: "coffee_carts_cafes",
  coffee_shop: "coffee_carts_cafes",
  restaurant: "wineries_dining",
  meal_takeaway: "wineries_dining",
  park: "parks_gardens",
  natural_feature: "nature_trails",
  hiking_area: "nature_trails",
  museum: "culture_history",
  art_gallery: "culture_history",
  shopping_mall: "shopping",
  store: "shopping",
  night_club: "events_festivals",
  bar: "wineries_dining",
  spa: "spa_relaxation",
  tourist_attraction: "attractions_activities",
  lodging: "attractions_activities",
  hotel: "attractions_activities",
  beach: "beaches_pools",
};

/** מנרמל את מערך ה-types שגוגל מחזירה למזהה סוג מסלול שלנו, אם מוכר. */
export function normalizeGoogleCategory(types: string[] | undefined): string | null {
  if (!types) return null;
  for (const type of types) {
    const mapped = GOOGLE_TYPE_TO_CATEGORY[type];
    if (mapped) return mapped;
  }
  return null;
}
/**
 * שאילתת חיפוש ספציפית לפי תת-קטגוריה (לא רק הקבוצה הראשית) - לשליטה
 * עדינה יותר בהוספה בכמות. השם עצמו (בעברית, מתוך tripTaxonomy) משמש
 * כשאילתת החיפוש בגוגל.
 */
export function subTagToSearchQuery(subTagLabel: string): string {
  return subTagLabel;
}