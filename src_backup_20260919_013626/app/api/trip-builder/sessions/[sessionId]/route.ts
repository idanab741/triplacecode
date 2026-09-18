import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** שולף session בודד (כולל final_itinerary) - משמש לצפייה בטיול שמור,
 *  למשל טיול TripMatch שנשמר ונפתח מחדש מעמוד "הטיולים שלי". */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,created_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "הטיול לא נמצא" }, { status: 404 });
  return NextResponse.json({ session: data });
}

/** מעדכן את final_itinerary של טיול קיים - משמש למשל למחיקת תחנה (מקום)
 *  מטיול TripMatch שמור, בלי לגעת בשאר השדות. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.final_itinerary) {
    return NextResponse.json({ error: "חסר final_itinerary" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .update({ final_itinerary: body.final_itinerary })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "הטיול לא נמצא" }, { status: 404 });
  return NextResponse.json({ success: true });
}

/** מוחק לגמרי session של טיול (בלתי הפיך) - רק אם הוא שייך למשתמש המחובר. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase
    .from("trip_builder_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
