import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaceStatusAndPhoto } from "./placePhotoService";
import { downloadAndStoreLegacyPhoto } from "@/services/places/legacyPhotoStorageService";

interface SessionForThumbnail {
  id: string;
  destination_image_url?: string | null;
  answers: Record<string, unknown> | null;
  final_itinerary: { stops?: { name?: string }[] } | null;
}

export async function getOrCacheTripThumbnail(
  supabase: SupabaseClient,
  session: SessionForThumbnail
): Promise<string | null> {
  if (session.destination_image_url) return session.destination_image_url;

  const answers = session.answers as { destination?: string; requestedArea?: string } | null;
  const firstStopName = session.final_itinerary?.stops?.[0]?.name;
  const photoQuery = answers?.destination ?? answers?.requestedArea ?? firstStopName ?? null;
  if (!photoQuery) return null;

  const photoResult = await findPlaceStatusAndPhoto(photoQuery);
  if (!photoResult.photoRef) return null;

  const storedUrl = await downloadAndStoreLegacyPhoto(photoResult.photoRef, `trip-thumbnails/${session.id}.jpg`);
  if (!storedUrl) return null;

  await supabase.from("trip_builder_sessions").update({ destination_image_url: storedUrl }).eq("id", session.id);

  return storedUrl;
}