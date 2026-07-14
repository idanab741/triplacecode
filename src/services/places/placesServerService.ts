import { createClient } from "@/services/supabase/server";

export interface PlaceSummary {
  id: string;
  name: string;
  rating: number | null;
  image_urls: string[];
}

export interface PlaceDetail {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  image_urls: string[];
  opening_hours: string[] | null;
  tags: string[];
}

/** לשימוש ב-Server Components בלבד. */
export async function getPlaceById(id: string): Promise<PlaceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  return data;
}

/** לשימוש ב-Server Components בלבד. */
export async function getPlacesByCityAndCategory(
  city: string,
  category: string,
  limit = 10
): Promise<PlaceSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("places")
    .select("id,name,rating,image_urls")
    .eq("city", city)
    .eq("category", category)
    .order("rating", { ascending: false })
    .limit(limit);
  return data ?? [];
}
