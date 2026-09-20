import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { TripInputError, deleteTrip, getTrip, updateTrip } from "@/services/social/tripService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  try {
    const trip = await getTrip(supabase, user.id, id);
    if (!trip) return NextResponse.json({ error: "הטיול לא נמצא" }, { status: 404 });
    return NextResponse.json({ trip });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת הטיול" }, { status: 500 });
  }
}

/** עריכה - רק היוצר (נאכף גם בשירות וגם ב-RLS). אותו גוף כמו יצירה. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    await updateTrip(supabase, user.id, id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TripInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בעדכון הטיול" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteTrip(supabase, user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה במחיקת הטיול" }, { status: 400 });
  }
}
