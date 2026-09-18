import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { markActivityRead } from "@/services/notifications/notificationsService";

/** id כאן הוא activity_key (מוצפן ב-URL, כי הוא מכיל ":" - ר'
 *  notificationsService.ts) - לא מזהה של שורה בטבלת notifications
 *  בהכרח, יכול להיות גם מפתח מחושב כמו "trip_saved:<sessionId>". */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const result = await markActivityRead(supabase, user.id, decodeURIComponent(id));
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error ?? "השמירה נכשלה" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
