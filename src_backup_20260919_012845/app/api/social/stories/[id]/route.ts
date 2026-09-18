import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { deleteStory } from "@/services/social/storyService";

/** מוחקת סטורי - רק המחבר שלו יכול, נאכף גם ב-service (eq author_id)
 *  וגם ב-RLS של הטבלה עצמה. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  await deleteStory(supabase, id, user.id);
  return NextResponse.json({ success: true });
}
