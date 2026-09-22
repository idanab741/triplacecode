import { createAdminClient } from "@/services/supabase/admin";
import { searchCityPlace, matchGooglePlaceByLocation } from "@/services/places/googlePlacesService";
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
      .select("id, name, category, city, address, google_place_id, subcategory, latitude, longitude")
      .eq("id", submissionId)
      .maybeSingle();

    if (error || !submission) {
      return;
    }

    // *** תיקון (בקשה מפורשת - "תיאור - תוציא מגוגל, איפה הדירוג, המרחק, הקטגוריות?"): ההחלטה הישנה כאן
    // הייתה למשוך רק דירוג/נגישות/מחיר, בלי תיאור - זה התהפך: תיאור (editorialSummary) נשלף ונשמר עכשיו
    // גם הוא, ר' patch.shortDescription למטה. עדיין לא תמונות/טלפון מגוגל - TripMatch (ר' tripMatchService.ts)
    // מציג רק תמונות שמשתמשים העלו, עם נפילה חזרה לתמונת ה-Google היחידה שכבר נשמרה מרגע ההגשה (google_photo_url)
    // רק כשאין אף תמונת משתמש - לא שולף/שומר עוד תמונות Google כאן.
    const patch: {
      subcategory?: string | null;
      accessible?: boolean | null;
      accessibleParking?: boolean | null;
      accessibleRestroom?: boolean | null;
      accessibleSeating?: boolean | null;
      priceLevel?: number | null;
      googleRating?: number | null;
      googleRatingCount?: number | null;
      openingHours?: string[] | null;
      shortDescription?: string | null;
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
      const googlePlace =
        submission.latitude != null && submission.longitude != null
          ? await matchGooglePlaceByLocation({
              name: submission.name,
              latitude: submission.latitude,
              longitude: submission.longitude,
            })
          : await searchCityPlace(`${submission.name} ${submission.city ?? submission.address ?? ""}`.trim());

      if (googlePlace) {
        // *** תוספת (בקשה מפורשת - "נגישות = מה שיש בגוגל", migration
        // 0085): כל 4 עובדות הנגישות שגוגל בפועל מספק - לא רק כניסה.
        if (googlePlace.accessibilityOptions?.wheelchairAccessibleEntrance !== undefined) {
          patch.accessible = googlePlace.accessibilityOptions.wheelchairAccessibleEntrance;
        }
        if (googlePlace.accessibilityOptions?.wheelchairAccessibleParking !== undefined) {
          patch.accessibleParking = googlePlace.accessibilityOptions.wheelchairAccessibleParking;
        }
        if (googlePlace.accessibilityOptions?.wheelchairAccessibleRestroom !== undefined) {
          patch.accessibleRestroom = googlePlace.accessibilityOptions.wheelchairAccessibleRestroom;
        }
        if (googlePlace.accessibilityOptions?.wheelchairAccessibleSeating !== undefined) {
          patch.accessibleSeating = googlePlace.accessibilityOptions.wheelchairAccessibleSeating;
        }
        const priceLevel = priceLevelFromGoogle(googlePlace.priceLevel);
        if (priceLevel !== null) patch.priceLevel = priceLevel;
        if (typeof googlePlace.rating === "number") {
          patch.googleRating = googlePlace.rating;
        }
        if (typeof googlePlace.userRatingCount === "number") {
          patch.googleRatingCount = googlePlace.userRatingCount;
        }
        // *** תיקון (בקשה מפורשת - "למה זה לא נשמר אוטומטית עם שעות
        // פעילות"): אותה קריאה בדיוק, שדה שכבר חוזר מגוגל ופשוט לא
        // נקרא עד עכשיו. weekdayDescriptions בעברית - הפורמט ש-
        // isPlaceOpenNow (utils/openingHours.ts) כבר יודע לפרש.
        if (googlePlace.regularOpeningHours?.weekdayDescriptions) {
          patch.openingHours = googlePlace.regularOpeningHours.weekdayDescriptions;
        }
        // *** תוספת (בקשה מפורשת - "תיאור - תוציא מגוגל מבחינתי"): אותה קריאה בדיוק ל-Google (ה-FIELD_MASK
        // כבר כלל "places.editorialSummary" - ר' googlePlacesService.ts) - רק לא נקרא עד עכשיו. תקציר
        // עריכתי אמיתי של גוגל, לא טקסט שממציא ה-AI.
        if (googlePlace.editorialSummary?.text) {
          patch.shortDescription = googlePlace.editorialSummary.text;
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
