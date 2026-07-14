import type { SupabaseClient } from "@supabase/supabase-js";
import { toggleFavorite, skipPlace } from "@/services/favorites/favoritesService";
import type { CandidatePlace } from "./types";

export async function likeStop(
  supabase: SupabaseClient,
  userId: string,
  stopId: string,
  candidate: CandidatePlace
): Promise<void> {
  await supabase
    .from("trip_builder_stops")
    .update({
      status: "liked",
      place_id: candidate.id,
      score: candidate.score ?? null,
      reason: candidate.reason ?? null,
    })
    .eq("id", stopId);

  await toggleFavorite(supabase, userId, candidate.id, "place", "liked");
}

export async function unlikeStop(
  supabase: SupabaseClient,
  userId: string,
  stopId: string,
  candidate: CandidatePlace
): Promise<void> {
  const { data: stop } = await supabase
    .from("trip_builder_stops")
    .select("rejected_place_ids")
    .eq("id", stopId)
    .maybeSingle();

  const rejected: string[] = stop?.rejected_place_ids ?? [];
  if (!rejected.includes(candidate.id)) {
    await supabase
      .from("trip_builder_stops")
      .update({ rejected_place_ids: [...rejected, candidate.id] })
      .eq("id", stopId);
  }

  await skipPlace(supabase, userId, candidate.id, "place");
}
