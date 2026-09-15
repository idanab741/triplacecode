import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

/** אותם 6 ערכים בדיוק כמו HomeQuickCategoryId (שורת "סוגי הטיול" בעמוד
 *  הבית) - לא טקסונומיה נפרדת. TripAdd הוא מאגר עצמאי, אבל הקטגוריות
 *  שלו מיושרות עם מה שכבר מוצג למשתמש בבית, לא ממציאות עוד סט. */
export type TripAddCategory = HomeQuickCategoryId;

export interface CreateTripAddSubmissionInput {
  submittedBy: string;
  name: string;
  category: TripAddCategory;
  description?: string;
  rating?: number;
  subcategory?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  mediaIds?: string[];
  googlePlaceId?: string;
  googlePhotoUrl?: string;
}

/**
 * *** מאגר עצמאי ונפרד לגמרי (בקשה מפורשת - "המאגר הזה מנותק מהמאגר
 * שהיה"): בכוונה **אין כאן שום בדיקה** מול places/destinations/
 * place_submissions - זה בדיוק מה שגרם לבלבול הקודם ("כבר קיים
 * אצלנו"). tripadd_submissions היא טבלה נפרדת, RLS נפרד, לא נוגעת
 * במאגר הישן בשום צורה.
 */
export async function createTripAddSubmission(supabase: SupabaseClient, input: CreateTripAddSubmissionInput): Promise<string> {
  const { data: submission, error } = await supabase
    .from("tripadd_submissions")
    .insert({
      submitted_by: input.submittedBy,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      rating: input.rating ?? null,
      // *** תיקון (בקשה מפורשת - "תתי קטגוריה קבועות לכל סוג"): המשתמש
      // יכול לבחור תת-קטגוריה בעצמו מרשימה סגורה בטופס - נשמר ישירות,
      // לא רק מחכה ל-AI אחרי השמירה (ר' tripAddEnrichmentService, שם
      // מכבד ערך קיים ולא דורס אותו).
      subcategory: input.subcategory ?? null,
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
    const { error: mediaError } = await supabase.from("tripadd_submission_media").insert(rows);
    if (mediaError) throw mediaError;
  }

  return submission.id as string;
}

export interface TripAddEnrichmentPatch {
  subcategory?: string | null;
  accessible?: boolean | null;
  priceLevel?: number | null;
  phone?: string | null;
  shortDescription?: string | null;
  openingHours?: string[] | null;
}

/** מיושם רק אחרי השמירה, ע"י tripAddEnrichmentService.ts בלבד - לא
 *  ישירות מהטופס (אותו עיקרון בדיוק כמו במאגר הישן, רק על הטבלה
 *  העצמאית tripadd_submissions). */
export async function applyTripAddEnrichment(
  supabase: SupabaseClient,
  submissionId: string,
  patch: TripAddEnrichmentPatch,
  status: "done" | "failed" | "skipped"
): Promise<void> {
  const update: Record<string, unknown> = { enrichment_status: status };
  if (patch.subcategory !== undefined) update.subcategory = patch.subcategory;
  if (patch.accessible !== undefined) update.accessible = patch.accessible;
  if (patch.priceLevel !== undefined) update.price_level = patch.priceLevel;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.shortDescription !== undefined) update.short_description = patch.shortDescription;
  if (patch.openingHours !== undefined) update.opening_hours = patch.openingHours;

  const { error } = await supabase.from("tripadd_submissions").update(update).eq("id", submissionId);
  if (error) throw error;
}

export async function getMyTripAddSubmissions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select("id, name, category, status, created_at, rejection_reason")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
