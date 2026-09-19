import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getFriendsMapPins } from "@/services/social/friendsMapService";

/** GET - פיני "המפה" בעמוד place's: כל המקומות שהחברים (והצופה) המליצו עליהם בפוסטים. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  try {
    const data = await getFriendsMapPins(supabase, user.id);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה בטעינת המפה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
