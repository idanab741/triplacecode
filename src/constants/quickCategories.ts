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
