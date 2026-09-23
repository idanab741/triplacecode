import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מצב הלייקים של קבוצת תגובות: GET ?ids=a,b,c -> { counts: { [commentId]: n }, liked: [commentId...] }.
 *  נקרא פעם אחת אחרי טעינת התגובות (במקום לשנות את שלושת ה-endpoints של התגובות - פוסט/חוויה/טיול). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ counts: {}, liked: [] });

  const { data, error } = await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const liked: string[] = [];
  for (const row of data ?? []) {
    const cid = row.comment_id as string;
    counts[cid] = (counts[cid] ?? 0) + 1;
    if (row.user_id === user.id) liked.push(cid);
  }
  return NextResponse.json({ counts, liked });
}
