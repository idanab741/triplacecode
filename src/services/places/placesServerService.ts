import { createClient } from "@/services/supabase/server";

export interface PlaceSummary {
  id: string;
  name: string;
  rating: number | null;
  image_urls: string[];
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
