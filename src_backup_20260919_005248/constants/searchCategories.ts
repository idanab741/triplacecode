export interface SearchCategoryChip {
  id: string;
  label: string;
  /** null = "הכל", בלי סינון קטגוריה. */
  categories: string[] | null;
}

export const SEARCH_CATEGORY_CHIPS: SearchCategoryChip[] = [
  { id: "all", label: "הכל", categories: null },
  { id: "coffee_carts_cafes", label: "בתי קפה", categories: ["coffee_carts_cafes"] },
  { id: "restaurants_culinary", label: "מסעדות", categories: ["restaurants_culinary"] },
  { id: "nature_landscapes", label: "טבע ונופים", categories: ["nature_landscapes"] },
  { id: "museums_culture", label: "מוזיאונים ותרבות", categories: ["museums_history", "culture_art"] },
  { id: "beaches_pools", label: "חופים", categories: ["beaches_pools"] },
  { id: "nightlife", label: "חיי לילה", categories: ["nightlife"] },
  { id: "attractions", label: "אטרקציות", categories: ["attractions"] },
];
