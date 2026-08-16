/**
 * 5 הקטגוריות הראשיות היחידות שמותר לשדה `places.category` לקבל.
 * זה השדה שמוצג בעמודת "קטגוריה" ברשימת המקומות (admin/places) ובפילטר
 * הקטגוריה שם - הוא *לא* אמור להכיל תתי-סוג עדין (כמו "cocktail_bar" או
 * "nature_trails") - זה תפקידו של `subcategory` / `tags`.
 *
 * לפני התיקון הזה, /api/admin/discovery-jobs/smart-search שמר בטעות את
 * תת-הסוג העדין ישירות לתוך `category` (ראו BUCKET_CATEGORIES הישן) - זו
 * הסיבה שבטבלה כל השורות הופיעו כ-"general_attractions" וכו'.
 */
export const PLACE_CATEGORIES = [
  { key: "restaurants", label: "מסעדות" },
  { key: "nightlife", label: "חיי לילה" },
  { key: "attractions", label: "אטרקציות" },
  { key: "nature", label: "טבע" },
  { key: "hotels", label: "מלונות" },
] as const;

export type PlaceCategoryKey = (typeof PLACE_CATEGORIES)[number]["key"];

export const PLACE_CATEGORY_LABELS: Record<PlaceCategoryKey, string> = Object.fromEntries(
  PLACE_CATEGORIES.map((c) => [c.key, c.label])
) as Record<PlaceCategoryKey, string>;

export function isValidPlaceCategory(value: string): value is PlaceCategoryKey {
  return PLACE_CATEGORIES.some((c) => c.key === value);
}

export function getPlaceCategoryLabel(categoryId: string): string {
  return PLACE_CATEGORY_LABELS[categoryId as PlaceCategoryKey] ?? categoryId;
}

/**
 * "קטגוריה ראשית" (place.category, 5 ערכים) הוא שדה תצוגה/סינון בלבד
 * ברשימת המקומות באדמין - מנוע החיפוש של בניית הטיול (fetchCandidatePool)
 * לא בודק אותו בכלל, הוא בודק רק overlap מול trip_type_tags. הבעיה
 * שגרמה למקום ("מלכה") להיות בלתי-נראה לחלוטין בחיפוש היתה בדיוק זו:
 * category="restaurants" נבחר, אבל trip_type_tags נשאר ריק/לא תואם - שני
 * השדות עצמאיים ולא מסונכרנים.
 *
 * המיפוי הזה משמש להצעה אוטומטית + אזהרה באדמין, כדי שהמצב הזה לא יקרה
 * שוב בשקט. לא כל הקטגוריות ניתנות למיפוי חד-חד-ערכי מלא (למשל "חיי
 * לילה" יכול להתאים למספר תגיות שונות בהתאם לסוג המקום בפועל, ו"מלונות"
 * לא מנוהלים כלל דרך trip_type_tags/fetchCandidatePool אלא בזרימה נפרדת
 * של חופשות בחו"ל) - לכן זו רשימת *הצעות סבירות*, לא אמת מוחלטת.
 */
export const CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS: Record<PlaceCategoryKey, string[]> = {
  restaurants: ["wineries_dining", "coffee_carts_cafes"],
  nightlife: ["wineries_dining", "attractions_activities", "events_festivals"],
  attractions: ["attractions_activities"],
  nature: ["nature_trails"],
  hotels: [],
};

/**
 * מיפוי הפוך למיפוי למעלה - עבור trip_type_tag נתון (למשל "wineries_dining"),
 * אילו ערכי category ראשיים "סבירים" בשבילו. משמש כ-fallback במנוע החיפוש
 * עצמו (candidatePoolService) - כדי שמקום שתויג נכון ב-category אבל לא
 * (או לא נכון) ב-trip_type_tags עדיין יימצא בחיפוש, במקום להיעלם בשקט.
 * זה לא מחליף את trip_type_tags כמנגנון הראשי - הוא רק רשת ביטחון.
 */
export const TRIP_TYPE_TAG_TO_FALLBACK_CATEGORIES: Record<string, PlaceCategoryKey[]> = {};
for (const categoryKey of Object.keys(CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS) as PlaceCategoryKey[]) {
  for (const tag of CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS[categoryKey]) {
    TRIP_TYPE_TAG_TO_FALLBACK_CATEGORIES[tag] = [...(TRIP_TYPE_TAG_TO_FALLBACK_CATEGORIES[tag] ?? []), categoryKey];
  }
}
