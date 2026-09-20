import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { CollectionInputError, deleteCollection, getCollection, updateCollection } from "@/services/social/collectionService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  try {
    const collection = await getCollection(supabase, user.id, id);
    if (!collection) return NextResponse.json({ error: "האוסף לא נמצא" }, { status: 404 });
    return NextResponse.json({ collection });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת האוסף" }, { status: 500 });
  }
}

/** עריכה - רק היוצר (נאכף גם בשירות וגם ב-RLS). מקבל את אותו גוף כמו יצירה, בלי type (הסוג לא ניתן לשינוי). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    await updateCollection(supabase, user.id, id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof CollectionInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בעדכון האוסף" }, { status: 400 });
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
    await deleteCollection(supabase, user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה במחיקת האוסף" }, { status: 400 });
  }
}
