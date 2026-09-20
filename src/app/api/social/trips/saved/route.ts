import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getViewerSavedTripCards } from "@/services/social/tripService";

/** טיולים (Trips) של אחרים ששמרתי - לבחירה בתוך אוסף מסוג טיולים ("הטיולים שאני רוצה לעשות"). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  try {
    const trips = await getViewerSavedTripCards(supabase, user.id);
    return NextResponse.json({ trips });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת הטיולים" }, { status: 500 });
  }
}
