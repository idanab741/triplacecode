import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createTripAddSubmission, getMyTripAddSubmissions, type TripAddCategory } from "@/services/tripadd/tripAddService";
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
 * *** מאגר עצמאי (TripAdd) - בכוונה **אין כאן שום בדיקת כפילות** מול
 * places/destinations/place_submissions (בקשה מפורשת - "המאגר הזה
 * מנותק מהמאגר שהיה"). כל שמירה נכנסת כ-pending בטבלה העצמאית
 * tripadd_submissions.
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

  try {
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
    });

    // fire-and-forget - לא מעכב את התשובה למשתמש, כשלון לא מכשיל את השמירה.
    enrichTripAddSubmission(id).catch(() => {});

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
