import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceSubmissionCategory = "restaurant" | "attraction" | "nature" | "nightlife" | "hotel" | "shopping";

export interface CreatePlaceSubmissionInput {
  submittedBy: string;
  name: string;
  category: PlaceSubmissionCategory;
  description?: string;
  /** דירוג 1-5 שהמשתמש עצמו נתן בטופס (לא AI/Google - ר' migration 0077). */
  rating?: number;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  mediaIds?: string[];
  /** ממולא אוטומטית מ-Google (search-result-details) אחרי שהמשתמש בחר
   *  הצעה מה-autocomplete - לא מוקלד ידנית (בקשה מפורשת). משמש גם
   *  לבדיקת כפילות מול places.google_place_id הקיים. undefined אם
   *  המשתמש המשיך ידנית כי גוגל לא מצא את המקום (סעיף 6 בפרומפט). */
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
      rating: input.rating ?? null,
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

/**
 * *** השלמת מידע אחרי השמירה (סעיף 7-8 בפרומפט - "לא להעמיס את זה
 * בטופס"): נקראת ע"י placeSubmissionEnrichmentService.enrichPlaceSubmission
 * בלבד (מופעלת כ-fire-and-forget מתוך POST /api/social/place-submissions
 * מיד אחרי היצירה) - לא ישירות מהטופס. AI מיועד רק לסיווג subcategory -
 * לעולם לא ממציא מידע עובדתי (מחיר/כתובת/שעות) שלא הגיע בפועל מ-Google.
 */
export interface SubmissionEnrichmentPatch {
  subcategory?: string | null;
  accessible?: boolean | null;
  priceLevel?: number | null;
  phone?: string | null;
  shortDescription?: string | null;
  openingHours?: string[] | null;
}

export async function applySubmissionEnrichment(
  supabase: SupabaseClient,
  submissionId: string,
  patch: SubmissionEnrichmentPatch,
  status: "done" | "failed" | "skipped"
): Promise<void> {
  const update: Record<string, unknown> = { enrichment_status: status };
  if (patch.subcategory !== undefined) update.subcategory = patch.subcategory;
  if (patch.accessible !== undefined) update.accessible = patch.accessible;
  if (patch.priceLevel !== undefined) update.price_level = patch.priceLevel;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.shortDescription !== undefined) update.short_description = patch.shortDescription;
  if (patch.openingHours !== undefined) update.opening_hours = patch.openingHours;

  const { error } = await supabase.from("place_submissions").update(update).eq("id", submissionId);
  if (error) throw error;
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
