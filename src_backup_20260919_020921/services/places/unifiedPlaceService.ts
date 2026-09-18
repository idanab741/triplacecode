import { createClient } from "@/services/supabase/client";

export interface UnifiedPlace {
  id: string;
  /** place = מקום בודד (בית קפה, מסעדה...). destination = יעד ברמת עיר. */
  type: "place" | "destination";
  name: string;
  category: string | null;
  subcategory: string | null;
  imageUrls: string[];
  rating: number | null;
  ratingCount: number | null;
  estimatedVisitMinutes: number | null;
  priceLevel: number | null;
  shortDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
}

/** מביא יעד לפי מזהה - מנסה תחילה בטבלת places, ואז destinations. */
export async function getUnifiedPlace(id: string): Promise<UnifiedPlace | null> {
  const supabase = createClient();

  const { data: place } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  if (place) {
    return {
      id: place.id,
      type: "place",
      name: place.name,
      category: place.category,
      subcategory: place.subcategory,
      imageUrls: place.image_urls ?? [],
      rating: place.rating,
      ratingCount: place.rating_count,
      estimatedVisitMinutes: place.estimated_visit_minutes,
      priceLevel: place.price_level,
      shortDescription: place.short_description,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      country: place.country,
    };
  }

  const { data: destination } = await supabase
    .from("destinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (destination) {
    return {
      id: destination.id,
      type: "destination",
      name: destination.name,
      category: null,
      subcategory: null,
      imageUrls: destination.image_url ? [destination.image_url] : [],
      rating: null,
      ratingCount: null,
      estimatedVisitMinutes: null,
      priceLevel: null,
      shortDescription: null,
      latitude: destination.latitude,
      longitude: destination.longitude,
      city: null,
      country: destination.country,
    };
  }

  return null;
}
