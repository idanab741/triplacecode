import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** משייכת אטרקציה קיימת (place_id) למהדורת יעד - גם עבור "הוסף אטרקציה
 *  קיימת" (חיפוש ידני במאגר) וגם עבור קישור אוטומטי אחרי "הוספה מרובה"
 *  (bulk add) דרך /api/admin/discovery-jobs/smart-search, שמריץ את
 *  היצירה בפועל ומחזיר את ה-place_id-ים החדשים לצד הלקוח - הצד הזה רק
 *  מקשר, לא יוצר places. onConflict מתעלם משיוך כפול (למשל אם המקום
 *  כבר משויך ליעד הזה) במקום להיכשל עם שגיאת unique constraint. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const placeIds: string[] | undefined = Array.isArray(body?.placeIds)
    ? body.placeIds
    : body?.placeId
      ? [body.placeId]
      : undefined;

  if (!placeIds || placeIds.length === 0) {
    return NextResponse.json({ error: "יש לספק placeId או placeIds" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("destination_edition_places")
    .upsert(
      placeIds.map((placeId) => ({ edition_id: id, place_id: placeId })),
      { onConflict: "edition_id,place_id", ignoreDuplicates: true }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, linked: placeIds.length });
}
