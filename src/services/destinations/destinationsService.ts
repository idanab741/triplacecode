import { createClient } from "@/services/supabase/client";

export interface FeaturedDestination {
  id: string;
  name: string;
  country: string;
  image_url: string | null;
}

export async function getFeaturedDestinations(limit = 10): Promise<FeaturedDestination[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}
