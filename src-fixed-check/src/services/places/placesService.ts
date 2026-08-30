import { createClient } from "@/services/supabase/client";

export interface Place {
  id: string;
  google_place_id: string | null;
  name: string;
  category: string;
  short_description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  estimated_visit_minutes: number | null;
  image_urls: string[];
  opening_hours: string[] | null;
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
}

/** "יעדים חמים" — כרגע פשוט המדורגים הכי גבוה, עד שיהיה מנוע המלצות. */
export async function getHotPlaces(limit = 10): Promise<Place[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("places")
    .select("*")
    .order("rating", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getPlaceById(id: string): Promise<Place | null> {
  const supabase = createClient();
  const { data } = await supabase.from("places").select("*").eq("id", id).single();
  return data;
}
