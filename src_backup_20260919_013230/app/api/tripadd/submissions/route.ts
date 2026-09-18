import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  createTripAddSubmission,
  createTripAddSharePost,
  findTripAddSubmissionByGooglePlaceId,
  getMyTripAddSubmissions,
  upsertTripAddReview,
  type TripAddCategory,
} from "@/services/tripadd/tripAddService";
import { enrichTripAddSubmission } from "@/services/tripadd/tripAddEnrichmentService";

const VALID_CATEGORIES: TripAddCategory[] = ["attraction", "food", "shopping", "nature", "nightlife", "sleep"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const submissions = await getMyTripAddSubmissions(supabase, user.id);
  return NextResponse.json({ submissions });
}

/**
 * *** מאגר עצמאי (TripAdd) - בכוונה **אין** כאן בדיקת כפילות מול
 * places/destinations/place_submissions הישנים (בקשה מפורשת - "המאגר
 * הזה מנותק מהמאגר שהיה"). כל שמירה נכנסת כ-pending בטבלה העצמאית
 * tripadd_submissions.
 *
 * *** תיקון (בקשה מפורשת - "Jasmino מופיע פעמיים... לאחד לפי
 * google_place_id"): זה כן נבדק בתוך המאגר העצמאי עצמו - אם יש כבר
 * submission עם אותו google_place_id, לא נוצר "מקום" שני; במקום זה
 * המשתמש מקבל/מעדכן ביקורת על המקום הקיים (ר' upsertTripAddReview).
 * הבחנה חשובה: זה שונה לגמרי מהבדיקה שהוסרה במפורש מול המאגר הישן -
 * שם המשתמש רצה בכוונה למנוע חסימה על "כבר קיים אצלנו" (טבלה אחרת,
 * דאטה ישן); כאן מדובר באותה טבלה בדיוק, אותו מקור אמת, ומטרת הבדיקה
 * הפוכה - לרכז ביקורות על אותו מקום קיים, לא לחסום הוספה.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const category = body?.category as TripAddCategory | undefined;
  const rating = body?.rating as number | undefined;
  if (!name?.trim() || !category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "חסר שם או קטגוריה לא תקינה" }, { status: 422 });
  }
  if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: "דירוג חייב להיות בין 1 ל-5" }, { status: 422 });
  }

  const googlePlaceId = body?.googlePlaceId as string | undefined;
  // *** תוספת (בקשה מפורשת - "שיתוף ב-place's", ברירת מחדל מסומן):
  // undefined (שדה לא נשלח בכלל, קליינט ישן) מתייחס כמו true - רק
  // false מפורש (המשתמש הוריד את הסימון) מבטל את השיתוף.
  const shareToPlaces = body?.shareToPlaces !== false;

  try {
    if (googlePlaceId) {
      const existing = await findTripAddSubmissionByGooglePlaceId(supabase, googlePlaceId);
      if (existing) {
        await upsertTripAddReview(supabase, {
          submissionId: existing.id,
          userId: user.id,
          rating,
          description: body?.description,
          mediaIds: body?.mediaIds,
        });
        if (shareToPlaces) {
          await createTripAddSharePost(supabase, {
            userId: user.id,
            submissionId: existing.id,
            text: body?.description,
            mediaIds: body?.mediaIds,
          }).catch(() => {});
        }
        // המקום כבר קיים ומועשר - אין צורך להריץ enrichment שוב.
        return NextResponse.json({ id: existing.id, mergedIntoExisting: true }, { status: 200 });
      }
    }

    const id = await createTripAddSubmission(supabase, {
      submittedBy: user.id,
      name: name.trim(),
      category,
      description: body?.description,
      rating,
      subcategory: body?.subcategory,
      city: body?.city,
      address: body?.address,
      latitude: body?.latitude,
      longitude: body?.longitude,
      website: body?.website,
      mediaIds: body?.mediaIds,
      googlePlaceId: body?.googlePlaceId,
      googlePhotoUrl: body?.googlePhotoUrl,
      googleMatchStatus: body?.googleMatchStatus,
      googleMatchConfidence: body?.googleMatchConfidence,
    });

    // fire-and-forget - לא מעכב את התשובה למשתמש, כשלון לא מכשיל את השמירה.
    enrichTripAddSubmission(id).catch(() => {});

    if (shareToPlaces) {
      // *** גם כאן fire-and-forget - כשלון ביצירת הפוסט לא אמור
      // להכשיל את שמירת המקום עצמו (הפעולה העיקרית שהמשתמש ביקש).
      createTripAddSharePost(supabase, {
        userId: user.id,
        submissionId: id,
        text: body?.description,
        mediaIds: body?.mediaIds,
      }).catch(() => {});
    }

    return NextResponse.json({ id, mergedIntoExisting: false }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
