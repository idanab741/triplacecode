import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { deleteCollectionComment } from "@/services/social/collectionService";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { commentId } = await params;
  try {
    await deleteCollectionComment(supabase, commentId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
