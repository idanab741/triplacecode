import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceSubmissionCategory = "restaurant" | "attraction" | "nature" | "nightlife" | "hotel";

export interface CreatePlaceSubmissionInput {
  submittedBy: string;
  name: string;
  category: PlaceSubmissionCategory;
  description?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  mediaIds?: string[];
  /** ממולא אוטומטית מ-Google (search-result-details) אחרי שהמשתמש בחר
   *  הצעה מה-autocomplete - לא מוקלד ידנית (בקשה מפורשת). משמש גם
   *  לבדיקת כפילות מול places.google_place_id הקיים. */
  googlePlaceId?: string;
  googlePhotoUrl?: string;
}

/** יצירת הצעת מקום חדש - נכנס כ-pending, לא הופך ל-Place אמיתי עד
 *  אישור Admin (סעיף 35 באפיון). בודק כפילות מול google_place_id לפני
 *  היצירה, כהגנה נוספת (הבדיקה הראשית כבר קורית ב-UI לפני שהטופס נשלח). */
export async function createPlaceSubmission(supabase: SupabaseClient, input: CreatePlaceSubmissionInput): Promise<string> {
  if (input.googlePlaceId) {
    const [placeMatch, destinationMatch] = await Promise.all([
      supabase.from("places").select("id").eq("google_place_id", input.googlePlaceId).maybeSingle(),
      supabase.from("destinations").select("id").eq("google_place_id", input.googlePlaceId).maybeSingle(),
    ]);
    if (placeMatch.data || destinationMatch.data) throw new Error("המקום הזה כבר קיים במאגר");
  }

  const { data: submission, error } = await supabase
    .from("place_submissions")
    .insert({
      submitted_by: input.submittedBy,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      website: input.website ?? null,
      google_place_id: input.googlePlaceId ?? null,
      google_photo_url: input.googlePhotoUrl ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.mediaIds?.length) {
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ submission_id: submission.id, media_id: mediaId, sort_order: sortOrder }));
    const { error: mediaError } = await supabase.from("place_submission_media").insert(rows);
    if (mediaError) throw mediaError;
  }

  return submission.id as string;
}

export async function getMySubmissions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("place_submissions")
    .select("id, name, category, status, created_at, rejection_reason")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
