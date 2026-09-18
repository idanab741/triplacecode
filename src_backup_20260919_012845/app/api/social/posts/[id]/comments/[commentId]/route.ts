import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { deleteComment } from "@/services/social/postService";

/**
 * *** תוספת (בקשה מפורשת - "למה אי אפשר למחוק תגובה?"): deleteComment
 * ב-postService.ts כבר היה קיים (soft-delete, deleted_at) - וגם ה-RLS
 * policy שמאפשר למשתמש למחוק/לעדכן את התגובה שלו עצמו כבר קיים
 * ב-migration 0068 - רק לא היה בכלל route שקורא לפונקציה הזו, וגם לא
 * שום UI שמציע את הפעולה. שני התיקונים (route + UI) ביחד סוגרים את זה.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { commentId } = await params;
  await deleteComment(supabase, commentId, user.id);
  return NextResponse.json({ ok: true });
}
