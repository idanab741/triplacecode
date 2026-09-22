import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTripCards } from "@/services/social/tripService";

/** הטיולים (Trips) שיצרתי - לבחירה בתוך אוסף מסוג טיולים. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  try {
    const trips = await getTripCards(supabase, user.id, { authorId: user.id, limit: 50 });
    return NextResponse.json({ trips });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת הטיולים" }, { status: 500 });
  }
}
