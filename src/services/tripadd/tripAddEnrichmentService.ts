import { createAdminClient } from "@/services/supabase/admin";
import { searchCityPlace } from "@/services/places/googlePlacesService";
import { callClaude } from "@/services/ai/claudeService";
import { applyTripAddEnrichment } from "@/services/tripadd/tripAddService";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

/** ממיר enum מחרוזת של Google ("PRICE_LEVEL_MODERATE" וכו') למספר 1-4 -
 *  לא ממציא מחיר מספרי מדויק, רק שומר את רמת המחיר כפי שגוגל מספקת. */
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
 * תהליך ההשלמה שרץ ברקע מיד אחרי "שמור מקום" ב-TripAdd - AI מסווג
 * *רק* תת-קטגוריה, Google משלים *רק* עובדות זמינות בפועל (לא ממציא).
 * נקרא מ-POST /api/tripadd/submissions כ-fire-and-forget.
 */
export async function enrichTripAddSubmission(submissionId: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    const { data: submission, error } = await supabase
      .from("tripadd_submissions")
      .select("id, name, category, city, address, google_place_id, subcategory")
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

    // *** תיקון (בקשה מפורשת - "תתי קטגוריה קבועות"): אם המשתמש כבר
    // בחר תת-קטגוריה בעצמו בטופס (מהרשימה הקבועה), לא דורסים אותה
    // בניחוש AI - מכבדים את הבחירה שלו.
    if (!submission.subcategory) {
      try {
        const categoryLabel = HOME_QUICK_CATEGORY_LABELS[submission.category as TripAddCategory] ?? submission.category;
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
    }

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
    await applyTripAddEnrichment(supabase, submissionId, patch, hasAnyData ? "done" : "skipped");
  } catch {
    try {
      await supabase.from("tripadd_submissions").update({ enrichment_status: "failed" }).eq("id", submissionId);
    } catch {
      // אין מה לעשות יותר - לא קריטי לשמירה עצמה.
    }
  }
}
