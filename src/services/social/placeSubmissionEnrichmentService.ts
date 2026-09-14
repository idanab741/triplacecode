import { createAdminClient } from "@/services/supabase/admin";
import { searchCityPlace } from "@/services/places/googlePlacesService";
import { callClaude } from "@/services/ai/claudeService";
import { applySubmissionEnrichment } from "@/services/social/placeSubmissionService";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const CATEGORY_LABELS_HE: Record<PlaceSubmissionCategory, string> = {
  restaurant: "מסעדות וקולינריה",
  attraction: "אטרקציות וחוויות",
  nature: "טבע ונופים",
  shopping: "קניות ושופינג",
  hotel: "לינה",
  nightlife: "חיי לילה ובילויים",
};

/** ממיר enum מחרוזת של Google ("PRICE_LEVEL_MODERATE" וכו') למספר 1-4 -
 *  אותה שיטה בדיוק כמו admin/places/[id]/enrich-from-google - לא ממציא
 *  מחיר מספרי מדויק, רק שומר את רמת המחיר כפי שגוגל בעצמה מספקת אותה. */
function priceLevelFromGoogle(raw: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return raw ? (map[raw] ?? null) : null;
}

/**
 * *** תהליך ההשלמה שרץ ברקע מיד אחרי "שמור מקום" (סעיף 7-8 בפרומפט):
 * (1) AI מסווג *רק* תת-קטגוריה, מבוסס על הקטגוריה הראשית + שם המקום -
 *     לעולם לא ממציא עובדות (מחיר/כתובת/שעות). (2) אם יש google_place_id
 *     (או לפחות שם+עיר), שולפים עובדות זמינות מ-Google Places (אותו
 *     googlePlacesService.ts הקיים ש-admin/places/[id]/enrich-from-google
 *     כבר משתמש בו - לא אינטגרציה חדשה). נתון שלא סופק ע"י Google לא
 *     "מומצא" - נשאר null.
 *
 * נקרא מ-POST /api/social/place-submissions כ-fire-and-forget - כשלון
 * כאן לא אמור להיכשיל את השמירה עצמה של המקום.
 */
export async function enrichPlaceSubmission(submissionId: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    const { data: submission, error } = await supabase
      .from("place_submissions")
      .select("id, name, category, city, address, google_place_id")
      .eq("id", submissionId)
      .maybeSingle();

    if (error || !submission) {
      return;
    }

    const patch: {
      subcategory?: string | null;
      accessible?: boolean | null;
      priceLevel?: number | null;
      phone?: string | null;
      shortDescription?: string | null;
      openingHours?: string[] | null;
    } = {};

    // (1) AI - סיווג תת-קטגוריה בלבד.
    try {
      const categoryLabel = CATEGORY_LABELS_HE[submission.category as PlaceSubmissionCategory] ?? submission.category;
      const prompt = `מקום בשם "${submission.name}", קטגוריה ראשית: ${categoryLabel}.
מה תת-הקטגוריה הכי מדויקת שלו? (לדוגמה: בית קפה / מסעדה איטלקית / בר קוקטיילים / חוף ים / קניון / מלון בוטיק וכו')
השב אך ורק במילה או צירוף קצר בעברית, בלי שום טקסט נוסף, בלי מרכאות.`;
      const { text } = await callClaude(prompt, 64);
      if (text) {
        patch.subcategory = text.trim().replace(/^["']|["']$/g, "").slice(0, 60);
      }
    } catch {
      // לא קריטי - ממשיכים בלי subcategory
    }

    // (2) Google - עובדות זמינות בלבד, לא ממציאים.
    try {
      const query = submission.google_place_id
        ? submission.name
        : `${submission.name} ${submission.city ?? submission.address ?? ""}`.trim();
      const googlePlace = query ? await searchCityPlace(query) : null;

      if (googlePlace) {
        if (googlePlace.accessibilityOptions?.wheelchairAccessibleEntrance !== undefined) {
          patch.accessible = googlePlace.accessibilityOptions.wheelchairAccessibleEntrance;
        }
        const priceLevel = priceLevelFromGoogle(googlePlace.priceLevel);
        if (priceLevel !== null) patch.priceLevel = priceLevel;
        if (googlePlace.nationalPhoneNumber) patch.phone = googlePlace.nationalPhoneNumber;
        if (googlePlace.editorialSummary?.text) patch.shortDescription = googlePlace.editorialSummary.text;
        if (googlePlace.regularOpeningHours?.weekdayDescriptions?.length) {
          patch.openingHours = googlePlace.regularOpeningHours.weekdayDescriptions;
        }
      }
    } catch {
      // לא קריטי - ממשיכים בלי העובדות האלה, לא ממציאים ערכים
    }

    const hasAnyData = Object.values(patch).some((v) => v !== undefined);
    await applySubmissionEnrichment(supabase, submissionId, patch, hasAnyData ? "done" : "skipped");
  } catch {
    // *** רשת ביטחון אחרונה: כל כשל בלתי-צפוי (למשל createAdminClient
    // עצמו, או applySubmissionEnrichment) מסמן enrichment_status='failed'
    // במקום להשאיר את השורה תקועה לנצח על 'pending' בלי שום סימון.
    try {
      await supabase.from("place_submissions").update({ enrichment_status: "failed" }).eq("id", submissionId);
    } catch {
      // אם גם זה נכשל - אין מה לעשות יותר, לא קריטי לשמירה עצמה של המקום.
    }
  }
}
