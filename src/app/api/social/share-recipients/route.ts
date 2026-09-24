import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

type ProfileRow = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

/**
 * *** למי אפשר לשלוח (בקשה מפורשת - "שליחה לחברים לא מוצאת חברים מהמאגר"):
 * קודם הגיליון טען רק את טבלת friendships - שאין באפליקציה דרך למלא (0 חברויות מאושרות), ולכן
 * תמיד הופיע "עוד אין לכם חברים". עכשיו:
 *  - בלי חיפוש: אנשים שכבר דיברתם איתם (לפי הצ'אט האחרון), אחריהם מי שאתם עוקבים אחריו, מי שעוקב
 *    אחריכם וחברויות מאושרות - בלי כפילויות.
 *  - עם חיפוש: כל משתמש באפליקציה לפי שם או שם משתמש.
 * חסומים (בכל כיוון) לא מוחזרים.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/[,()%*\\]/g, " ").trim();

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
  const blocked = new Set((blockRows ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id) as string));

  const toDto = (p: ProfileRow) => ({ id: p.id, username: p.username, fullName: p.full_name, avatarUrl: p.avatar_url });

  if (q) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq("id", user.id)
      .limit(30);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ people: ((data ?? []) as ProfileRow[]).filter((p) => !blocked.has(p.id)).map(toDto) });
  }

  const [convRes, followingRes, followersRes, friendsRes] = await Promise.all([
    supabase
      .from("dm_conversations")
      .select("user_a_id, user_b_id, last_message_at")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase.from("follows").select("following_id").eq("follower_id", user.id).limit(200),
    supabase.from("follows").select("follower_id").eq("following_id", user.id).limit(200),
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
  ]);

  const ordered: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && id !== user.id && !blocked.has(id) && !ordered.includes(id)) ordered.push(id);
  };
  for (const c of convRes.data ?? []) add(c.user_a_id === user.id ? c.user_b_id : c.user_a_id);
  for (const f of friendsRes.data ?? []) add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
  for (const f of followingRes.data ?? []) add(f.following_id);
  for (const f of followersRes.data ?? []) add(f.follower_id);

  if (ordered.length === 0) return NextResponse.json({ people: [] });

  const { data: profiles, error } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ordered.slice(0, 120));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  return NextResponse.json({ people: ordered.map((id) => byId.get(id)).filter((p): p is ProfileRow => !!p).map(toDto) });
}
