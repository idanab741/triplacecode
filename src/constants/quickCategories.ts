export type QuickCategoryId =
  | "restaurants_cafes"
  | "romantic_date"
  | "weekend"
  | "nature_trip"
  | "day_trip";

export interface QuickCategoryDefinition {
  id: QuickCategoryId;
  /** משתנה ה-CSS של צבע ההדגשה (מתוך theme/tokens.css) */
  colorVar: string;
}

export const QUICK_CATEGORIES: QuickCategoryDefinition[] = [
  { id: "restaurants_cafes", colorVar: "--color-category-orange" },
  { id: "romantic_date", colorVar: "--color-category-pink" },
  { id: "weekend", colorVar: "--color-category-purple" },
  { id: "nature_trip", colorVar: "--color-category-green" },
  { id: "day_trip", colorVar: "--color-primary-start" },
];

/**
 * מקור אמת יחיד למיפוי בין קטגוריה מהירה לסינון שנפתח ב-/search.
 * category = מזהי קטגוריה של places (בהתאמה ל-SEARCH_CATEGORY_CHIPS).
 * query = מונח חיפוש חופשי, לקטגוריות שאין להן קטגוריית places ברורה.
 */
export const QUICK_CATEGORY_SEARCH_LINKS: Record<
  QuickCategoryId,
  { categories?: string[]; query?: string }
> = {
  restaurants_cafes: { categories: ["restaurants_culinary", "coffee_carts_cafes"] },
  romantic_date: { query: "רומנטי" },
  weekend: { categories: ["hotels"] },
  nature_trip: { categories: ["nature_landscapes"] },
  day_trip: { categories: ["attractions"] },
};
