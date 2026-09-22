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

  // *** תוספת (בקשה מפורשת - TripMatch עובר להציג רק אטרקציות tripadd, ר' tripMatchService.ts):
  // בלי זה, לייק על אטרקציית tripadd לא היה נפתר בכלל כאן (רק places/destinations נבדקו) - "אטרקציות
  // שאהבתם" בעמוד "הבחירות שלי" היה מציג רשימה ריקה. /place/[id] כבר בודק tripadd_submissions ראשון
  // (ר' ההערה שם) - אז ניווט אליו ("/place/{id}") כבר עבד; רק ה-DTO לרשימה עצמה היה חסר.
  const { data: tripadd } = await supabase
    .from("tripadd_submissions")
    .select("id, name, category, subcategory, short_description, latitude, longitude, city, price_level, tripadd_submission_media(sort_order, media_assets(url))")
    .eq("id", id)
    .maybeSingle();
  if (tripadd) {
    const media = (
      tripadd.tripadd_submission_media as unknown as { sort_order: number; media_assets: { url: string } | null }[] | null
    )
      ?.filter((m) => m.media_assets?.url)
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: tripadd.id,
      type: "place",
      name: tripadd.name,
      category: tripadd.category,
      subcategory: tripadd.subcategory,
      imageUrls: (media ?? []).map((m) => m.media_assets!.url),
      // *** בקשה מפורשת (TripMatch): לא מציגים דירוג/מרחק/תיאור לאטרקציות tripadd - null בכוונה, לא חוסר-מידע.
      rating: null,
      ratingCount: null,
      estimatedVisitMinutes: null,
      priceLevel: tripadd.price_level,
      shortDescription: null,
      latitude: tripadd.latitude,
      longitude: tripadd.longitude,
      city: tripadd.city,
      country: null,
    };
  }

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
