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
