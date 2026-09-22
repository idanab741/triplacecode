import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getCollectionCards } from "@/services/social/collectionService";

const PAGE_SIZE = 12;

/** טאב "אוספים" בעמוד הפרופיל: האוספים של המשתמש שהצופה רשאי לראות (ה-RLS על collections מחליט -
 *  היוצר רואה הכל, אחרים רק public / friends / followers לפי היחס ביניהם). */
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
    const collections = await getCollectionCards(supabase, user.id, { authorId: profile.id, limit: PAGE_SIZE, cursor });
    const nextCursor = collections.length === PAGE_SIZE ? collections[collections.length - 1].createdAt : null;
    return NextResponse.json({ collections, nextCursor });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת האוספים" }, { status: 500 });
  }
}
