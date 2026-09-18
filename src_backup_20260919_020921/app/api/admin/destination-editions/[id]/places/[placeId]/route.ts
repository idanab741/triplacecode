import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מסירה את השיוך של אטרקציה למהדורת היעד הזו בלבד - שורת ה-place
 *  עצמה ב-places נשארת נגישה במאגר הכללי ובכל שיוך אחר שלה (לא מחיקה
 *  גלובלית), בדיוק כמו שסוכם. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; placeId: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, placeId } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("destination_edition_places")
    .delete()
    .eq("edition_id", id)
    .eq("place_id", placeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
