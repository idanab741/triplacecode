import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getFeed } from "@/services/social/feedService";

/** פוסטים של משתמש ספציפי לטאב "פוסטים" בעמוד הפרופיל (place's) -
 *  משתמש ב-getFeed הקיים עם authorId, כדי לא לשכפל את כל ה-batching
 *  של authors/media/stats/viewerState. ה-RLS על posts כבר קובע אילו
 *  פוסטים של אותו משתמש הצופה בכלל רשאי לראות (public/followers/friends). */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { username } = await params;
  const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!profile) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  const { items, nextCursor } = await getFeed(supabase, user.id, "for_you", 15, cursor, profile.id);
  return NextResponse.json({ items, nextCursor });
}
