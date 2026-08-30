import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** שולף תוצאה שמורה בודדת מ-trippy_ai_results - משמש לפתיחה מחדש של
 *  תוצאת הצ'אט המהיר מ"הטיולים שלי" (ר' MyTripsSection.tsx), גם אחרי
 *  רענון/סגירת טאב שבהם sessionStorage כבר לא זמין. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data, error } = await supabase
    .from("trippy_ai_results")
    .select("id,title,stops,search_context,share_token,created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 404 });
  return NextResponse.json({ result: data });
}

/** מעדכן את מערך התחנות (stops) של תוצאה שמורה - משמש בכל פעולה
 *  שמשנה את המסלול (סוויפ/מחיקה/סידור מחדש/הוספת עצירה) כדי שהשינוי
 *  יישאר גם בפעם הבאה שנפתח מ"הטיולים שלי", לא רק ב-state הזמני של
 *  העמוד. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.stops)) {
    return NextResponse.json({ error: "חסר stops" }, { status: 400 });
  }

  const { error } = await supabase
    .from("trippy_ai_results")
    .update({ stops: body.stops, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** מוחק לגמרי תוצאה שמורה של הצ'אט המהיר (בלתי הפיך) - רק אם היא
 *  שייכת למשתמש המחובר. משמש לגרירה-למחיקה בכרטיס ב"הטיולים שלי". */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase.from("trippy_ai_results").delete().eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
