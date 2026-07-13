import { searchCityPlace } from "@/services/places/googlePlacesService";
import { downloadAndStorePhoto } from "@/services/places/photoStorageService";
import { getWikipediaSummary } from "./wikipediaService";
import { createAdminClient } from "@/services/supabase/admin";

export interface CollectDestinationInput {
  /** השם שיוצג באפליקציה (בעברית) - נקבע על ידינו, לא נלקח מגוגל. */
  name: string;
  country: string;
  /** שאילתת החיפוש שנשלחת לגוגל כדי למצוא את התמונה והקואורדינטות. */
  searchQuery: string;
}

export interface CollectDestinationResult {
  name: string;
  country: string;
  imageUrl: string | null;
}

/** מושך תמונת נוף מייצגת לעיר יעד, ושומר אותה ב-destinations. */
export async function collectDestination({
  name,
  country,
  searchQuery,
}: CollectDestinationInput): Promise<CollectDestinationResult> {
  const raw = await searchCityPlace(searchQuery);
  if (!raw) {
    throw new Error(`לא נמצאה תוצאה עבור: ${searchQuery}`);
  }

  const photos = raw.photos ?? [];
  const imageUrl =
    photos.length > 0
      ? await downloadAndStorePhoto(photos[0].name, `destinations/${raw.id}.jpg`)
      : null;

  const description = raw.editorialSummary?.text ?? (await getWikipediaSummary(name));

  const supabase = createAdminClient();
  const { error } = await supabase.from("destinations").upsert(
    {
      google_place_id: raw.id,
      name,
      country,
      description,
      image_url: imageUrl,
      latitude: raw.location?.latitude ?? null,
      longitude: raw.location?.longitude ?? null,
    },
    { onConflict: "google_place_id" }
  );

  if (error) {
    throw new Error(`שמירה נכשלה: ${error.message}`);
  }

  return { name, country, imageUrl };
}
