import { createClient } from "@/services/supabase/client";

export interface PlaceSearchResult {
  id: string;
  name: string;
  category: string;
  rating: number | null;
  city: string | null;
  image_urls: string[];
}

export interface SearchFilters {
  query: string;
  /** ריק = הכל, ללא סינון קטגוריה */
  categories: string[];
  minRating: number | null;
  /** מקסימום רמת מחיר (0-4) */
  maxPriceLevel: number | null;
  kosher: boolean;
  accessible: boolean;
}

export const SEARCH_PAGE_SIZE = 20;

export async function searchPlaces(
  filters: SearchFilters,
  offset: number,
  limit: number = SEARCH_PAGE_SIZE
): Promise<PlaceSearchResult[]> {
  const supabase = createClient();

  let q = supabase.from("places").select("id,name,category,rating,city,image_urls");

  const trimmedQuery = filters.query.trim();
  if (trimmedQuery) {
    q = q.textSearch("search_vector", trimmedQuery, { type: "websearch", config: "simple" });
  }
  if (filters.categories.length > 0) {
    q = q.in("category", filters.categories);
  }
  if (filters.minRating != null) {
    q = q.gte("rating", filters.minRating);
  }
  if (filters.maxPriceLevel != null) {
    q = q.lte("price_level", filters.maxPriceLevel);
  }

  const requiredTags: string[] = [];
  if (filters.kosher) requiredTags.push("kosher");
  if (filters.accessible) requiredTags.push("accessible");
  if (requiredTags.length > 0) {
    q = q.contains("tags", requiredTags);
  }

  q = q.order("rating", { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

  const { data } = await q;
  return data ?? [];
}
