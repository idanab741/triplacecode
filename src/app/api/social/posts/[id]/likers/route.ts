import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מי עשה לייק לפוסט - עד 8 האחרונים (לעיגולים הקטנים מעל שורת הפעולות בכרטיס), + הסה"כ.
 *  ה-RLS של post_likes כבר מגביל לפוסטים שהצופה רשאי לראות. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const { data: likes, count, error } = await supabase
    .from("post_likes")
    .select("user_id, created_at", { count: "exact" })
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (likes ?? []).map((l) => l.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const likers = ids
    .map((uid) => byId.get(uid))
    .filter(Boolean)
    .map((p) => ({ id: p!.id, username: p!.username, fullName: p!.full_name, avatarUrl: p!.avatar_url }));

  return NextResponse.json({ likers, total: count ?? likers.length });
}
