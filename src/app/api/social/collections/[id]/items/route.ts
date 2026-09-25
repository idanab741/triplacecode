import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { addItemsToCollection, CollectionInputError } from "@/services/social/collectionService";

/** הוספה מהירה של פריטים לסוף מפה קיימת - רק היוצר (נאכף בשירות וב-RLS). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(await addItemsToCollection(supabase, user.id, id, body));
  } catch (err) {
    if (err instanceof CollectionInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בהוספה למפה" }, { status: 400 });
  }
}
