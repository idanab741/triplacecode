import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTripCards } from "@/services/social/tripService";

const PAGE_SIZE = 12;

/** טאב "טיולים" בעמוד הפרופיל: הטיולים שהמשתמש יצר ופרסם ושהצופה רשאי לראות
 *  (ה-RLS על trips מחליט - טיול פרטי נראה רק ליוצר). */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { username } = await params;
  const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!profile) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;

  try {
    const trips = await getTripCards(supabase, user.id, { authorId: profile.id, limit: PAGE_SIZE, cursor });
    const nextCursor = trips.length === PAGE_SIZE ? trips[trips.length - 1].createdAt : null;
    return NextResponse.json({ trips, nextCursor });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת הטיולים" }, { status: 500 });
  }
}
