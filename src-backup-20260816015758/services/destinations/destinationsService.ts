import { createClient } from "@/services/supabase/client";

export interface FeaturedDestination {
  id: string;
  name: string;
  country: string;
  image_url: string | null;
}

export async function getFeaturedDestinations(limit = 20): Promise<FeaturedDestination[]> {
  const supabase = createClient();
  // רק יעדים "חמים/מותאמים" אמיתיים - לא כל הערים שנוספו לרשימת
  // בחירת המיקום/TripMatch (is_hot_destination=false). שני אוספים שונים
  // לגמרי, גם אם הם חיים באותה טבלה.
  const { data } = await supabase
    .from("destinations")
    .select("*")
    .eq("is_hot_destination", true)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}
